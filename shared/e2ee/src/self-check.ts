import {
  type CiphersuiteImpl,
  type ClientState,
  createApplicationMessage,
  createCommit,
  createGroup,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  type MLSMessage,
  mlsExporter,
  processPrivateMessage,
} from "ts-mls";
import { asciiBytes } from "./bytes";
import { realmCryptoProvider } from "./provider";

export interface SelfCheckStep {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
}

const CIPHERSUITE = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519";

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function privateMessageOf(m: MLSMessage) {
  if (m.wireformat !== "mls_private_message") throw new Error("expected a private message");
  return m.privateMessage;
}

/**
 * Runs the whole MLS life of a small group on this device: keys, group, add, join, message,
 * removal and the call key. A developer check (phase 1), not part of any chat. `now` is the
 * platform's clock in milliseconds (performance.now), passed in so this file needs no globals.
 */
export async function runSelfCheck(now: () => number, groupSize = 5): Promise<SelfCheckStep[]> {
  const steps: SelfCheckStep[] = [];
  let failed = false;

  async function step<T>(name: string, run: () => Promise<T>): Promise<T | undefined> {
    if (failed) {
      steps.push({ name, ok: false, ms: 0, detail: "skipped (an earlier step failed)" });
      return undefined;
    }
    const start = now();
    try {
      const out = await run();
      steps.push({ name, ok: true, ms: now() - start });
      return out;
    } catch (e) {
      failed = true;
      steps.push({ name, ok: false, ms: now() - start, detail: (e as Error).message ?? String(e) });
      return undefined;
    }
  }

  let impl!: CiphersuiteImpl;
  await step("Load the ciphersuite", async () => {
    impl = await getCiphersuiteImpl(getCiphersuiteFromName(CIPHERSUITE), realmCryptoProvider);
  });

  const people = await step(`Make ${groupSize} device keys`, () =>
    Promise.all(
      Array.from({ length: groupSize }, (_, i) =>
        generateKeyPackage(
          { credentialType: "basic", identity: asciiBytes(`device-${i}`) },
          defaultCapabilities(),
          defaultLifetime,
          [],
          impl,
        ),
      ),
    ),
  );

  let owner!: ClientState;
  await step("Start a group", async () => {
    const first = people?.[0];
    if (!first) throw new Error("no keys");
    owner = await createGroup(
      asciiBytes("self-check"),
      first.publicPackage,
      first.privatePackage,
      [],
      impl,
    );
  });

  const invited = people?.slice(1) ?? [];
  let members: ClientState[] = [];
  await step(`Add ${groupSize - 1} people`, async () => {
    const added = await createCommit(
      { state: owner, cipherSuite: impl },
      {
        extraProposals: invited.map((p) => ({
          proposalType: "add",
          add: { keyPackage: p.publicPackage },
        })),
      },
    );
    owner = added.newState;
    const welcome = added.welcome;
    if (!welcome) throw new Error("no welcome");
    for (const p of invited) {
      members.push(
        await joinGroup(
          welcome,
          p.publicPackage,
          p.privatePackage,
          emptyPskIndex,
          impl,
          owner.ratchetTree,
        ),
      );
    }
  });

  const text = asciiBytes("hello from this phone");
  await step("Send and read a message", async () => {
    const sent = await createApplicationMessage(owner, text, impl);
    owner = sent.newState;
    members = await Promise.all(
      members.map(async (m) => {
        const got = await processPrivateMessage(m, sent.privateMessage, emptyPskIndex, impl);
        if (got.kind !== "applicationMessage" || !sameBytes(got.message, text)) {
          throw new Error("a member read the wrong text");
        }
        return got.newState;
      }),
    );
  });

  const callKey = (s: ClientState) =>
    mlsExporter(s.keySchedule.exporterSecret, "realm call", new Uint8Array(), 32, impl);
  await step("Everyone gets the same call key", async () => {
    const [a, b] = [await callKey(owner), await callKey(members[0] as ClientState)];
    if (!sameBytes(a, b)) throw new Error("call keys differ");
  });

  await step("Remove someone; they can't read new messages", async () => {
    const removed = members[0] as ClientState;
    const removal = await createCommit(
      { state: owner, cipherSuite: impl },
      { extraProposals: [{ proposalType: "remove", remove: { removed: 1 } }] },
    );
    owner = removal.newState;
    const rest = await Promise.all(
      members.slice(1).map(async (m) => {
        const got = await processPrivateMessage(
          m,
          privateMessageOf(removal.commit),
          emptyPskIndex,
          impl,
        );
        return got.newState;
      }),
    );
    const after = await createApplicationMessage(owner, asciiBytes("after"), impl);
    const reader = await processPrivateMessage(
      rest[0] as ClientState,
      after.privateMessage,
      emptyPskIndex,
      impl,
    );
    if (reader.kind !== "applicationMessage") throw new Error("a remaining member couldn't read");
    const leaked = await processPrivateMessage(
      removed,
      after.privateMessage,
      emptyPskIndex,
      impl,
    ).then(
      () => true,
      () => false,
    );
    if (leaked) throw new Error("the removed person could still read");
  });

  return steps;
}
