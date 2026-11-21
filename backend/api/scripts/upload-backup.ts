/**
 * Sends one database backup, read from stdin, to the private R2 bucket. Run nightly by
 * infra/beta/backup-db.sh inside the api container (which has the storage keys):
 *
 *   node backend/api/node_modules/tsx/dist/cli.mjs backend/api/scripts/upload-backup.ts \
 *     backups/db/realm-mon.dump < realm-2026-11-21.dump
 *
 * The key must sit under backups/: nothing in the app ever serves that folder.
 */
import { S3Store } from "@realm/server-core";

const KEY = /^backups\/db\/[a-z0-9-]{1,60}\.dump$/;
const MAX_BYTES = 2 * 1024 ** 3;

async function readStdin(): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("backup is bigger than 2 GB; send it another way");
    parts.push(chunk as Buffer);
  }
  return Buffer.concat(parts);
}

async function main() {
  const key = process.argv[2] ?? "";
  if (!KEY.test(key)) throw new Error(`key must look like backups/db/<name>.dump, got "${key}"`);
  const env = process.env;
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("R2 settings (S3_*) are missing");
  }
  const body = await readStdin();
  if (body.length < 1024) throw new Error(`backup is only ${body.length} bytes; not sending it`);

  const store = new S3Store({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION || "auto",
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  });
  const put = await store.presignPut(key, {
    contentType: "application/octet-stream",
    sizeBytes: body.length,
    expiresSeconds: 600,
  });
  const res = await fetch(put.url, {
    method: "PUT",
    headers: put.headers,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!res.ok) throw new Error(`R2 answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const check = await store.head(key);
  if (!check || check.sizeBytes !== body.length) throw new Error("R2 copy has the wrong size");
  process.stdout.write(`uploaded ${key} (${body.length} bytes)\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `backup upload failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
