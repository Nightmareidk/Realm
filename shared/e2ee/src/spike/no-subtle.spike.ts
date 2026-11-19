/**
 * Phase 1 spike: run ts-mls the way Hermes (the phone's JavaScript engine) would, with no
 * WebCrypto `subtle`, only `getRandomValues` (which expo-crypto provides). Run with:
 *   node --experimental-strip-types src/spike/no-subtle.spike.ts
 */
import { webcrypto } from "node:crypto";

const getRandomValues = webcrypto.getRandomValues.bind(webcrypto);
Object.defineProperty(globalThis, "crypto", {
  value: { getRandomValues },
  configurable: true,
  writable: true,
});

const mls = await import("ts-mls");
const provider = mls.nobleCryptoProvider;
const enc = new TextEncoder();

async function step(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

let impl: Awaited<ReturnType<typeof mls.getCiphersuiteImpl>>;
let alice: Awaited<ReturnType<typeof mls.generateKeyPackage>>;
let bob: Awaited<ReturnType<typeof mls.generateKeyPackage>>;
let group: Awaited<ReturnType<typeof mls.createGroup>>;
let commit: Awaited<ReturnType<typeof mls.createCommit>>;
let bobGroup: Awaited<ReturnType<typeof mls.joinGroup>>;

await step("ciphersuite", async () => {
  impl = await mls.getCiphersuiteImpl(
    mls.getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
    provider,
  );
});
await step("key packages (Ed25519 + X25519 keys)", async () => {
  const kp = (name: string) =>
    mls.generateKeyPackage(
      { credentialType: "basic", identity: enc.encode(name) },
      mls.defaultCapabilities(),
      mls.defaultLifetime,
      [],
      impl,
    );
  alice = await kp("alice");
  bob = await kp("bob");
});
await step("create group", async () => {
  group = await mls.createGroup(
    enc.encode("g"),
    alice.publicPackage,
    alice.privatePackage,
    [],
    impl,
  );
});
await step("add bob (HPKE seal)", async () => {
  commit = await mls.createCommit(
    { state: group, cipherSuite: impl },
    { extraProposals: [{ proposalType: "add", add: { keyPackage: bob.publicPackage } }] },
  );
});
await step("bob joins (HPKE open)", async () => {
  bobGroup = await mls.joinGroup(
    commit.welcome!,
    bob.publicPackage,
    bob.privatePackage,
    mls.emptyPskIndex,
    impl,
    commit.newState.ratchetTree,
  );
});
await step("message round trip (AES-GCM)", async () => {
  const sent = await mls.createApplicationMessage(commit.newState, enc.encode("hi"), impl);
  const got = await mls.processPrivateMessage(
    bobGroup,
    sent.privateMessage,
    mls.emptyPskIndex,
    impl,
  );
  if (got.kind !== "applicationMessage" || new TextDecoder().decode(got.message) !== "hi") {
    throw new Error("wrong text");
  }
});
