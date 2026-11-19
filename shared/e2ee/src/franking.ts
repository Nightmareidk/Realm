import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { asciiBytes, type Bytes } from "./bytes";

/**
 * Message franking (docs/E2EE.md §17): how a reported message is proven without the server ever
 * reading anything else. The sender puts a random key inside the encrypted message and sends
 * HMAC-SHA256(key, message) beside it. Someone reporting the message reveals the text and the key,
 * and anyone can recompute the commitment. Standard HMAC from @noble/hashes; nothing home-made.
 */

export const FRANKING_KEY_BYTES = 32;
export const FRANKING_COMMITMENT_BYTES = 32;
/** Encrypted messages are padded to a multiple of this, so their length says little (§12.3). */
export const PADDING_BUCKET = 256;
/** The biggest payload one encrypted message may carry. */
export const MAX_PAYLOAD_BYTES = 16 * 1024;

const FRAME_VERSION = 1;
const HEADER = 1 + FRANKING_KEY_BYTES + 4;
const SNOWFLAKE = /^[1-9]\d{0,19}$/;

function concat(parts: Bytes[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** The commitment for one message. The chat and the sender are bound in, so it can't be reused. */
export function frankingCommitment(
  frankingKey: Bytes,
  payload: Bytes,
  channelId: string,
  senderUserId: string,
): Bytes {
  if (frankingKey.length !== FRANKING_KEY_BYTES) throw new Error("invalid franking key");
  if (!SNOWFLAKE.test(channelId) || !SNOWFLAKE.test(senderUserId)) throw new Error("invalid id");
  const label = asciiBytes(`REALM-FRANK-V1\nchannel:${channelId}\nsender:${senderUserId}\n`);
  return hmac(sha256, frankingKey, concat([label, payload]));
}

/** Same length, same bytes, in time that doesn't depend on where they differ. */
export function equalBytes(a: Bytes, b: Bytes): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

/** What goes inside the MLS message: the franking key, the payload, and zero padding. */
export function packFrame(frankingKey: Bytes, payload: Bytes): Bytes {
  if (frankingKey.length !== FRANKING_KEY_BYTES) throw new Error("invalid franking key");
  if (payload.length > MAX_PAYLOAD_BYTES) throw new Error("message too long");
  const size = Math.ceil((HEADER + payload.length) / PADDING_BUCKET) * PADDING_BUCKET;
  const out = new Uint8Array(size);
  out[0] = FRAME_VERSION;
  out.set(frankingKey, 1);
  new DataView(out.buffer).setUint32(1 + FRANKING_KEY_BYTES, payload.length);
  out.set(payload, HEADER);
  return out;
}

export function unpackFrame(frame: Bytes): { frankingKey: Bytes; payload: Bytes } {
  if (frame.length < HEADER || frame.length % PADDING_BUCKET !== 0) throw new Error("bad frame");
  if (frame[0] !== FRAME_VERSION) throw new Error("unknown frame version");
  const length = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(
    1 + FRANKING_KEY_BYTES,
  );
  if (length > MAX_PAYLOAD_BYTES || HEADER + length > frame.length) throw new Error("bad frame");
  for (let i = HEADER + length; i < frame.length; i++) {
    if (frame[i] !== 0) throw new Error("bad padding");
  }
  return {
    frankingKey: frame.slice(1, 1 + FRANKING_KEY_BYTES),
    payload: frame.slice(HEADER, HEADER + length),
  };
}

/**
 * The safety number two people compare to confirm nobody is in the middle (§6.4): 60 digits from
 * both account identity keys. The same on both sides, whoever computes it.
 */
export function safetyNumber(
  a: { userId: string; accountKey: Bytes },
  b: { userId: string; accountKey: Bytes },
): string {
  if (!SNOWFLAKE.test(a.userId) || !SNOWFLAKE.test(b.userId)) throw new Error("invalid id");
  const [first, second] = BigInt(a.userId) <= BigInt(b.userId) ? [a, b] : [b, a];
  const groups: string[] = [];
  for (const round of [0, 1]) {
    const digest = sha256(
      concat([
        asciiBytes(`REALM-SAFETY-V1\nround:${round}\n${first.userId}\n${second.userId}\n`),
        first.accountKey,
        second.accountKey,
      ]),
    );
    for (let g = 0; g < 6; g++) {
      let n = 0n;
      for (let i = 0; i < 5; i++) n = (n << 8n) | BigInt(digest[g * 5 + i] as number);
      groups.push((n % 100000n).toString().padStart(5, "0"));
    }
  }
  return groups.join(" ");
}
