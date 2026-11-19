/**
 * Phase 1 spike (docs/E2EE.md §22): does ts-mls do what Realm needs, at group-chat size, and how
 * big and slow is it? Not product code: it proves the library and prints numbers for the plan.
 */
import {
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeMlsMessage,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  mlsExporter,
  nobleCryptoProvider,
  type Proposal,
  processPrivateMessage,
  zeroOutUint8Array,
} from "ts-mls";
import { describe, expect, it } from "vitest";

const GROUP_SIZE = 25;
const enc = new TextEncoder();
const dec = new TextDecoder();
const results: Record<string, string> = {};

function note(label: string, value: string) {
  results[label] = value;
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const out = await run();
  note(label, `${(performance.now() - start).toFixed(1)} ms`);
  return out;
}

function privateMessageOf(bytes: Uint8Array) {
  const decoded = decodeMlsMessage(bytes, 0)?.[0];
  if (decoded?.wireformat !== "mls_private_message") throw new Error("expected a private message");
  return decoded.privateMessage;
}

describe("ts-mls spike: one 25-person group", () => {
  it("adds 24 people in one commit, everyone reads, a removed person can't", async () => {
    const impl = await getCiphersuiteImpl(
      getCiphersuiteFromName("MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"),
      nobleCryptoProvider,
    );

    // Every device makes a KeyPackage (what phase 0's /e2ee/key-packages stores).
    const people = await timed(`make ${GROUP_SIZE} key packages`, () =>
      Promise.all(
        Array.from({ length: GROUP_SIZE }, (_, i) => {
          const credential: Credential = {
            credentialType: "basic",
            identity: enc.encode(`device-${i}`),
          };
          return generateKeyPackage(credential, defaultCapabilities(), defaultLifetime, [], impl);
        }),
      ),
    );
    const kpBytes = encodeMlsMessage({
      keyPackage: people[1]!.publicPackage,
      wireformat: "mls_key_package",
      version: "mls10",
    });
    note(
      "one key package",
      `${kpBytes.length} bytes (${Math.ceil((kpBytes.length * 4) / 3)} as base64url)`,
    );
    // The server's KeyPackageBlob limit is 100–4096 base64url characters.
    expect(Math.ceil((kpBytes.length * 4) / 3)).toBeLessThan(4096);

    const [owner, ...invited] = people;
    let ownerState: ClientState = await createGroup(
      enc.encode("space-chat-1"),
      owner!.publicPackage,
      owner!.privatePackage,
      [],
      impl,
    );

    const adds: Proposal[] = invited.map((p) => ({
      proposalType: "add",
      add: { keyPackage: p.publicPackage },
    }));
    const added = await timed(`commit adding ${GROUP_SIZE - 1}`, () =>
      createCommit({ state: ownerState, cipherSuite: impl }, { extraProposals: adds }),
    );
    ownerState = added.newState;
    added.consumed.forEach(zeroOutUint8Array);
    const welcomeBytes = encodeMlsMessage({
      welcome: added.welcome!,
      wireformat: "mls_welcome",
      version: "mls10",
    });
    note("welcome for 24", `${welcomeBytes.length} bytes`);
    note("group state, saved", `${encodeGroupState(ownerState).length} bytes`);

    const welcome = decodeMlsMessage(welcomeBytes, 0)?.[0];
    if (welcome?.wireformat !== "mls_welcome") throw new Error("expected a welcome");
    const joinStart = performance.now();
    let members: ClientState[] = [];
    for (const p of invited) {
      members.push(
        await joinGroup(
          welcome.welcome,
          p.publicPackage,
          p.privatePackage,
          emptyPskIndex,
          impl,
          ownerState.ratchetTree,
        ),
      );
    }
    note("one person joins", `${((performance.now() - joinStart) / invited.length).toFixed(1)} ms`);

    // The owner writes; all 24 read it.
    const hello = await timed("encrypt one message", () =>
      createApplicationMessage(ownerState, enc.encode("hello everyone"), impl),
    );
    ownerState = hello.newState;
    const helloBytes = encodeMlsMessage({
      privateMessage: hello.privateMessage,
      wireformat: "mls_private_message",
      version: "mls10",
    });
    note("'hello everyone' on the wire", `${helloBytes.length} bytes`);

    const readStart = performance.now();
    members = await Promise.all(
      members.map(async (state) => {
        const got = await processPrivateMessage(
          state,
          privateMessageOf(helloBytes),
          emptyPskIndex,
          impl,
        );
        if (got.kind !== "applicationMessage") throw new Error("expected a message");
        expect(dec.decode(got.message)).toBe("hello everyone");
        got.consumed.forEach(zeroOutUint8Array);
        return got.newState;
      }),
    );
    note(
      "one person decrypts",
      `${((performance.now() - readStart) / members.length).toFixed(2)} ms`,
    );

    // Everyone derives the same call key (LiveKit frame encryption, §14).
    const callKey = (s: ClientState) =>
      mlsExporter(s.keySchedule.exporterSecret, "realm call", new Uint8Array(), 32, impl);
    const ownerCallKey = await callKey(ownerState);
    expect(await callKey(members[7]!)).toEqual(ownerCallKey);

    // The owner removes person 3 (leaf 3); the others follow the commit.
    const removedLeaf = 3;
    const removal = await timed("commit removing one", () =>
      createCommit(
        { state: ownerState, cipherSuite: impl },
        { extraProposals: [{ proposalType: "remove", remove: { removed: removedLeaf } }] },
      ),
    );
    ownerState = removal.newState;
    removal.consumed.forEach(zeroOutUint8Array);
    const removalBytes = encodeMlsMessage(removal.commit);
    note("removal commit", `${removalBytes.length} bytes`);

    const removed = members[removedLeaf - 1]!;
    const stillIn: ClientState[] = [];
    const followStart = performance.now();
    for (const [i, state] of members.entries()) {
      if (i === removedLeaf - 1) continue;
      const got = await processPrivateMessage(
        state,
        privateMessageOf(removalBytes),
        emptyPskIndex,
        impl,
      );
      expect(got.kind).toBe("newState");
      stillIn.push(got.newState);
    }
    note(
      "one person follows a commit",
      `${((performance.now() - followStart) / stillIn.length).toFixed(1)} ms`,
    );
    expect(await callKey(stillIn[0]!)).not.toEqual(ownerCallKey);

    // A new message after the removal: the others read it, the removed person can't.
    const after = await createApplicationMessage(ownerState, enc.encode("after"), impl);
    const afterBytes = encodeMlsMessage({
      privateMessage: after.privateMessage,
      wireformat: "mls_private_message",
      version: "mls10",
    });
    const reader = await processPrivateMessage(
      stillIn[5]!,
      privateMessageOf(afterBytes),
      emptyPskIndex,
      impl,
    );
    expect(reader.kind === "applicationMessage" && dec.decode(reader.message)).toBe("after");
    await expect(
      processPrivateMessage(removed, privateMessageOf(afterBytes), emptyPskIndex, impl),
    ).rejects.toThrow();

    console.table(results);
  }, 120_000);
});
