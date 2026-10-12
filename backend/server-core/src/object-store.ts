import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Where uploads live. Browsers never hold storage credentials: they get a short-lived signed URL
 * to put one file, and read files through the API (which checks access, then hands back a
 * short-lived signed URL). Production uses any S3-compatible service (Cloudflare R2); development
 * without one keeps files in a folder on this machine.
 */
export interface ObjectStore {
  readonly kind: "s3" | "local";
  /** Where the browser sends files directly, for the page's Content-Security-Policy. */
  readonly browserOrigin: string | null;
  presignPut(
    key: string,
    opts: { contentType: string; sizeBytes: number; expiresSeconds: number },
  ): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(
    key: string,
    opts: { expiresSeconds: number; contentType?: string; downloadAs?: string },
  ): Promise<string>;
  head(key: string): Promise<{ sizeBytes: number; contentType: string | null } | null>;
  /** Bytes `start`..`end` inclusive (for sniffing a file's real type). */
  read(key: string, start: number, end: number): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

// ── S3 / R2: AWS Signature Version 4, query-string signing ──────────────────

/** RFC 3986 encoding, as SigV4 wants it. */
function enc(value: string, keepSlash = false) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(keepSlash ? /%2F/g : /$^/, "/");
}

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

export interface S3Options {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Path-style `/bucket/key` (R2, MinIO). False when the bucket is already in the endpoint's host. */
  bucketInPath?: boolean;
}

export class S3Store implements ObjectStore {
  readonly kind = "s3" as const;
  readonly browserOrigin: string;
  private readonly endpoint: URL;

  constructor(private readonly o: S3Options) {
    this.endpoint = new URL(o.endpoint);
    this.browserOrigin = this.endpoint.origin;
  }

  /** A presigned URL for one request (path-style: /bucket/key, which R2 supports). */
  presign(
    method: string,
    key: string,
    opts: {
      expiresSeconds: number;
      headers?: Record<string, string>;
      query?: Record<string, string>;
    },
    now = new Date(),
  ): string {
    const amzDate = now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const day = amzDate.slice(0, 8);
    const scope = `${day}/${this.o.region}/s3/aws4_request`;
    const host = this.endpoint.host;
    const bucket = this.o.bucketInPath === false ? "" : `/${enc(this.o.bucket)}`;
    const path = `${this.endpoint.pathname.replace(/\/$/, "")}${bucket}/${enc(key, true)}`;

    const headers: Record<string, string> = { host, ...(opts.headers ?? {}) };
    const names = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .sort();
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const signedHeaders = names.join(";");

    const query: Record<string, string> = {
      ...(opts.query ?? {}),
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.o.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(opts.expiresSeconds),
      "X-Amz-SignedHeaders": signedHeaders,
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${enc(k)}=${enc(query[k] ?? "")}`)
      .join("&");
    const canonicalHeaders = names.map((n) => `${n}:${String(lower[n]).trim()}\n`).join("");
    const canonicalRequest = [
      method,
      path,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
    const kDate = hmac(`AWS4${this.o.secretAccessKey}`, day);
    const kSigning = hmac(hmac(hmac(kDate, this.o.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
    return `${this.endpoint.origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }

  async presignPut(
    key: string,
    opts: { contentType: string; sizeBytes: number; expiresSeconds: number },
  ) {
    // Type and exact size are signed: the upload must be what was declared.
    const headers = { "content-type": opts.contentType, "content-length": String(opts.sizeBytes) };
    const url = this.presign("PUT", key, { expiresSeconds: opts.expiresSeconds, headers });
    return { url, headers: { "Content-Type": opts.contentType } };
  }

  async presignGet(
    key: string,
    opts: { expiresSeconds: number; contentType?: string; downloadAs?: string },
  ) {
    const query: Record<string, string> = {};
    if (opts.contentType) query["response-content-type"] = opts.contentType;
    if (opts.downloadAs)
      query["response-content-disposition"] = contentDisposition(opts.downloadAs);
    return this.presign("GET", key, { expiresSeconds: opts.expiresSeconds, query });
  }

  async head(key: string) {
    const res = await fetch(this.presign("HEAD", key, { expiresSeconds: 60 }), { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`object store HEAD ${res.status}`);
    return {
      sizeBytes: Number(res.headers.get("content-length") ?? 0),
      contentType: res.headers.get("content-type"),
    };
  }

  async read(key: string, start: number, end: number) {
    const res = await fetch(this.presign("GET", key, { expiresSeconds: 60 }), {
      headers: { range: `bytes=${start}-${end}` },
    });
    if (!res.ok) throw new Error(`object store GET ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string) {
    const res = await fetch(this.presign("DELETE", key, { expiresSeconds: 60 }), {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) throw new Error(`object store DELETE ${res.status}`);
  }
}

/** `attachment; filename=...`, safe for any name (RFC 6266 with a UTF-8 fallback). */
export function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${enc(name)}`;
}

// ── Local folder (development only) ─────────────────────────────────────────

/**
 * Files in a folder, with the same "signed URL" shape: the API itself accepts the upload and
 * serves the file at `/v1/media/local/...`, checking an HMAC instead of S3's signature.
 */
export class LocalStore implements ObjectStore {
  readonly kind = "local" as const;
  readonly browserOrigin = null;
  private readonly root: string;

  constructor(
    dir: string,
    private readonly secret: string,
    /** How the browser reaches the API's local media route (same-origin through the web app). */
    private readonly publicBase = "/api/v1/media/local",
  ) {
    this.root = resolve(dir);
  }

  private sign(method: string, key: string, expires: number, extra = "") {
    return createHmac("sha256", this.secret)
      .update(`${method}\n${key}\n${expires}\n${extra}`)
      .digest("base64url");
  }

  /** The absolute path for a key, refusing anything that would escape the folder. */
  path(key: string) {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error("bad key");
    return full;
  }

  verify(method: string, key: string, expires: number, sig: string, extra = "") {
    if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
    const want = Buffer.from(this.sign(method, key, expires, extra));
    const got = Buffer.from(sig);
    return want.length === got.length && timingSafeEqual(want, got);
  }

  private url(method: string, key: string, expiresSeconds: number, extra = "", more = "") {
    const e = Math.floor(Date.now() / 1000) + expiresSeconds;
    return `${this.publicBase}/${enc(key, true)}?e=${e}&s=${this.sign(method, key, e, extra)}${more}`;
  }

  async presignPut(
    key: string,
    opts: { contentType: string; sizeBytes: number; expiresSeconds: number },
  ) {
    const extra = `${opts.contentType}\n${opts.sizeBytes}`;
    return {
      url: this.url("PUT", key, opts.expiresSeconds, extra),
      headers: { "Content-Type": opts.contentType },
    };
  }

  async presignGet(
    key: string,
    opts: { expiresSeconds: number; contentType?: string; downloadAs?: string },
  ) {
    const extra = `${opts.contentType ?? ""}\n${opts.downloadAs ?? ""}`;
    const more = `${opts.contentType ? `&t=${enc(opts.contentType)}` : ""}${opts.downloadAs ? `&d=${enc(opts.downloadAs)}` : ""}`;
    return this.url("GET", key, opts.expiresSeconds, extra, more);
  }

  async head(key: string) {
    try {
      const s = await stat(this.path(key));
      return { sizeBytes: s.size, contentType: null };
    } catch {
      return null;
    }
  }

  async read(key: string, start: number, end: number) {
    const fh = await open(this.path(key), "r");
    try {
      const buf = Buffer.alloc(end - start + 1);
      const { bytesRead } = await fh.read(buf, 0, buf.length, start);
      return new Uint8Array(buf.subarray(0, bytesRead));
    } finally {
      await fh.close();
    }
  }

  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }

  async ensureDir(key: string) {
    await mkdir(dirname(this.path(key)), { recursive: true });
  }
}
