import { Redis } from "ioredis";
import type { Logger } from "./logger";

/**
 * Background jobs (processing an upload, fanning a message out to push notifications): work
 * that shouldn't make anyone wait. With Redis, jobs go on a list and a worker process takes
 * them; without it (development, tests) they run in this process right after the request.
 * At-least-once: handlers must be safe to run twice.
 */
export interface JobQueue {
  enqueue(name: string, data: Record<string, unknown>): Promise<void>;
  /** Start taking jobs of these names (worker processes; the in-memory queue runs them inline). */
  process(handlers: Record<string, JobHandler>): void;
  close(): Promise<void>;
}

export type JobHandler = (data: Record<string, unknown>) => Promise<void>;

export class MemoryQueue implements JobQueue {
  private handlers: Record<string, JobHandler> = {};
  /** Every job enqueued, for assertions in tests. */
  readonly jobs: { name: string; data: Record<string, unknown> }[] = [];
  private pending = new Set<Promise<void>>();

  constructor(private readonly logger?: Logger) {}

  async enqueue(name: string, data: Record<string, unknown>) {
    this.jobs.push({ name, data });
    const handler = this.handlers[name];
    if (!handler) return;
    const run = new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => handler(data))
      .catch((err) => this.logger?.error({ err, job: name }, "job failed"))
      .finally(() => this.pending.delete(run));
    this.pending.add(run);
  }

  process(handlers: Record<string, JobHandler>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /** Wait for jobs already started (tests). */
  async drain() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  async close() {
    await this.drain();
  }
}

const KEY = "realm:jobs";

export class RedisQueue implements JobQueue {
  private readonly push: Redis;
  private take: Redis | null = null;
  private running = false;

  constructor(
    private readonly url: string,
    private readonly logger?: Logger,
  ) {
    this.push = new Redis(url);
  }

  async enqueue(name: string, data: Record<string, unknown>) {
    await this.push.lpush(KEY, JSON.stringify({ name, data, at: Date.now() }));
  }

  process(handlers: Record<string, JobHandler>) {
    if (this.running) return;
    this.running = true;
    // A blocking pop needs its own connection.
    this.take = new Redis(this.url, { maxRetriesPerRequest: null });
    const loop = async () => {
      while (this.running && this.take) {
        try {
          const got = await this.take.brpop(KEY, 5);
          if (!got) continue;
          const job = JSON.parse(got[1]) as { name: string; data: Record<string, unknown> };
          const handler = handlers[job.name];
          if (!handler) {
            this.logger?.warn({ job: job.name }, "no handler for job");
            continue;
          }
          await handler(job.data).catch((err) =>
            this.logger?.error({ err, job: job.name }, "job failed"),
          );
        } catch (err) {
          if (!this.running) return;
          this.logger?.error({ err }, "job queue: read failed");
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    };
    void loop();
  }

  async close() {
    this.running = false;
    await Promise.allSettled([this.push.quit(), this.take?.quit()]);
  }
}
