import { createHmac, createSign } from "node:crypto";

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** A JSON Web Token signed with a shared secret (HS256), e.g. LiveKit access tokens. */
export function signHS256(payload: Record<string, unknown>, secret: string): string {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** A JSON Web Token signed with an RSA private key (RS256), e.g. Google service accounts. */
export function signRS256(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  keyId?: string,
): string {
  const head = b64url(
    JSON.stringify({ alg: "RS256", typ: "JWT", ...(keyId ? { kid: keyId } : {}) }),
  );
  const body = b64url(JSON.stringify(payload));
  const sig = createSign("RSA-SHA256")
    .update(`${head}.${body}`)
    .sign(privateKeyPem)
    .toString("base64url");
  return `${head}.${body}.${sig}`;
}

/** The payload of a JWT, without checking it (for tests and logs only). */
export function decodeJwt(token: string): Record<string, unknown> {
  const body = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
}
