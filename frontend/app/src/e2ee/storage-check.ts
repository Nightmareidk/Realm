import { asciiBytes, asciiText, type SelfCheckStep } from "@realm/e2ee";
import { corruptRecord, openDeviceStore, wipeDeviceStore } from "./device-store";

const SPACE = "self-check";

/**
 * Developer builds only: proves the sealed store works on this phone. It makes a storage key in
 * the phone's keystore, seals a record with AES-256-GCM, reads it back, checks a tampered file
 * is refused, then removes everything it made. Uses its own space, never an account's.
 */
export async function runStorageCheck(now: () => number): Promise<SelfCheckStep[]> {
  const steps: SelfCheckStep[] = [];
  let failed = false;

  async function step(name: string, run: () => Promise<void>) {
    if (failed) {
      steps.push({ name, ok: false, ms: 0, detail: "skipped (an earlier step failed)" });
      return;
    }
    const start = now();
    try {
      await run();
      steps.push({ name, ok: true, ms: now() - start });
    } catch (err) {
      failed = true;
      steps.push({
        name,
        ok: false,
        ms: now() - start,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const secret = "a saved message only this phone can read";
  let store: Awaited<ReturnType<typeof openDeviceStore>> = null;

  await step("Make a storage key in the phone's keystore", async () => {
    await wipeDeviceStore(SPACE);
    store = await openDeviceStore(SPACE);
    if (!store) throw new Error("sealed storage isn't available on this platform yet");
  });
  await step("Seal and save a record (AES-256-GCM)", async () => {
    await store?.put("chat:1", asciiBytes(secret));
  });
  await step("Open it again after a restart", async () => {
    const reopened = await openDeviceStore(SPACE);
    const back = await reopened?.get("chat:1");
    if (!back || asciiText(back) !== secret) throw new Error("the record came back different");
  });
  await step("A changed file is refused", async () => {
    await corruptRecord(SPACE, "chat:1");
    const opened = await store?.get("chat:1").then(
      () => true,
      () => false,
    );
    if (opened) throw new Error("a tampered record was accepted");
  });
  await step("Without the key, nothing opens", async () => {
    await store?.put("chat:2", asciiBytes(secret));
    await wipeDeviceStore(SPACE);
    const fresh = await openDeviceStore(SPACE);
    if ((await fresh?.get("chat:2")) != null) throw new Error("old records survived a key wipe");
    await wipeDeviceStore(SPACE);
  });

  return steps;
}
