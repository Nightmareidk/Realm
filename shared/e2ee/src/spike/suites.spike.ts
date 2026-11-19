/**
 * Spike: the same two-person chat under different MLS ciphersuites, to compare the 128-bit launch
 * suite with the 256-bit ones (docs/E2EE.md, "cipher strength"). Run: npx vite-node <this file>
 */
import {
  createApplicationMessage,
  createCommit,
  createGroup,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  encodeMlsMessage,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  nobleCryptoProvider,
  processPrivateMessage,
} from "ts-mls";

const names = [
  "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519",
  "MLS_256_DHKEMP384_AES256GCM_SHA384_P384",
  "MLS_256_DHKEMP521_AES256GCM_SHA512_P521",
  "MLS_256_XWING_AES256GCM_SHA512_Ed25519",
] as const;

const enc = new TextEncoder();
for (const name of names) {
  try {
    const t0 = performance.now();
    const impl = await getCiphersuiteImpl(getCiphersuiteFromName(name), nobleCryptoProvider);
    const kp = (who: string) =>
      generateKeyPackage(
        { credentialType: "basic", identity: enc.encode(who) },
        defaultCapabilities(),
        defaultLifetime,
        [],
        impl,
      );
    const a = await kp("a");
    const b = await kp("b");
    const kpBytes = encodeMlsMessage({
      keyPackage: b.publicPackage,
      wireformat: "mls_key_package",
      version: "mls10",
    }).length;
    let group = await createGroup(enc.encode("1"), a.publicPackage, a.privatePackage, [], impl);
    const add = await createCommit(
      { state: group, cipherSuite: impl },
      {
        extraProposals: [{ proposalType: "add", add: { keyPackage: b.publicPackage } }],
        ratchetTreeExtension: true,
      },
    );
    group = add.newState;
    if (!add.welcome) throw new Error("no welcome");
    const welcomeBytes = encodeMlsMessage({
      welcome: add.welcome,
      wireformat: "mls_welcome",
      version: "mls10",
    }).length;
    const bob = await joinGroup(
      add.welcome,
      b.publicPackage,
      b.privatePackage,
      emptyPskIndex,
      impl,
    );
    const t1 = performance.now();
    const sent = await createApplicationMessage(group, enc.encode("hello"), impl);
    const got = await processPrivateMessage(bob, sent.privateMessage, emptyPskIndex, impl);
    const t2 = performance.now();
    const rotate = await createCommit({ state: sent.newState, cipherSuite: impl });
    const t3 = performance.now();
    console.log(
      `ok   ${name}\n     key package ${kpBytes} B, welcome ${welcomeBytes} B, commit ${
        encodeMlsMessage(rotate.commit).length
      } B | setup ${(t1 - t0).toFixed(0)} ms, message ${(t2 - t1).toFixed(1)} ms, key change ${(
        t3 - t2
      ).toFixed(0)} ms | ${got.kind}`,
    );
  } catch (e) {
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}
