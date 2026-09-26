import { REALM_EPOCH_MS } from "@realm/contracts";

const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_WORKER = (1 << Number(WORKER_BITS)) - 1;
const SEQUENCE_MASK = (1n << SEQUENCE_BITS) - 1n;

/**
 * 64-bit time-sortable IDs: 41 bits ms since the Realm epoch | 10 bits worker | 12 bits sequence.
 * 4096 IDs per ms per worker; on overflow or clock regression we borrow from the next
 * millisecond rather than ever emitting a duplicate or going backwards.
 */
export class SnowflakeGenerator {
  private lastMs = -1n;
  private sequence = 0n;
  private readonly worker: bigint;

  constructor(
    workerId: number,
    private readonly clock: () => number = Date.now,
  ) {
    if (!Number.isInteger(workerId) || workerId < 0 || workerId > MAX_WORKER) {
      throw new Error(`Snowflake worker ID must be 0–${MAX_WORKER}, got ${workerId}`);
    }
    this.worker = BigInt(workerId);
  }

  next(): bigint {
    let ms = BigInt(this.clock()) - REALM_EPOCH_MS;
    if (ms < this.lastMs) ms = this.lastMs;

    if (ms === this.lastMs) {
      this.sequence = (this.sequence + 1n) & SEQUENCE_MASK;
      if (this.sequence === 0n) ms = this.lastMs + 1n;
    } else {
      this.sequence = 0n;
    }

    this.lastMs = ms;
    return (ms << (WORKER_BITS + SEQUENCE_BITS)) | (this.worker << SEQUENCE_BITS) | this.sequence;
  }
}
