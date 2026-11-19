import {
  type BlobStore,
  type Bytes,
  type KeyStore,
  SealedKeyStore,
  type SubtleAesGcm,
  subtleAes256GcmSealer,
} from "@realm/e2ee";

/**
 * Where a browser keeps everything for encrypted chats (docs/E2EE.md §10). The 256-bit storage
 * key is a WebCrypto key made as non-extractable: the page can use it to seal and open records,
 * but no code, not even Realm's own, can read the key itself. It lives in IndexedDB beside the
 * sealed records. This protects against someone copying the browser's files; it does not protect
 * against code running in the page, and clearing site data removes the device (§19).
 */

const SPACE = /^[A-Za-z0-9-]{1,40}$/;
const dbName = (space: string) => `realm-e2ee-${space}`;
const KEYS = "keys";
const RECORDS = "records";

const done = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("storage error"));
  });

/** Connections this page holds, so a wipe can close them first (an open one blocks deletion). */
const connections = new Map<string, Set<IDBDatabase>>();

async function open(space: string): Promise<IDBDatabase> {
  const request = indexedDB.open(dbName(space), 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(KEYS);
    request.result.createObjectStore(RECORDS);
  };
  const db = await done(request);
  const held = connections.get(space) ?? new Set();
  connections.set(space, held.add(db));
  // Another tab is wiping or upgrading it: let go rather than block that tab.
  db.onversionchange = () => {
    db.close();
    held.delete(db);
  };
  return db;
}

class IndexedBlobs implements BlobStore {
  constructor(private readonly db: IDBDatabase) {}

  private records(mode: IDBTransactionMode) {
    return this.db.transaction(RECORDS, mode).objectStore(RECORDS);
  }

  async get(name: string): Promise<Bytes | null> {
    const value = await done<unknown>(this.records("readonly").get(name));
    return value instanceof Uint8Array ? value : null;
  }

  async put(name: string, value: Bytes): Promise<void> {
    await done(this.records("readwrite").put(value, name));
  }

  async delete(name: string): Promise<void> {
    await done(this.records("readwrite").delete(name));
  }
}

/** True where the browser can keep sealed records: IndexedDB and WebCrypto on a secure page. */
function supported() {
  return (
    typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && Boolean(crypto.subtle)
  );
}

/** Opens this browser's sealed store for one account, making its storage key on first use. */
export async function openDeviceStore(space: string): Promise<KeyStore | null> {
  if (!SPACE.test(space)) throw new Error("invalid store name");
  if (!supported()) return null;
  const db = await open(space);
  const keys = () => db.transaction(KEYS, "readwrite").objectStore(KEYS);
  let key = (await done<unknown>(keys().get("storage"))) as CryptoKey | undefined;
  if (!key) {
    // `false`: not extractable. The browser will never hand the key's bytes to any script.
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await done(keys().put(key, "storage"));
  }
  const subtle = crypto.subtle as unknown as SubtleAesGcm<CryptoKey>;
  return new SealedKeyStore(new IndexedBlobs(db), subtleAes256GcmSealer(subtle, key));
}

/** Removes an account's keys and saved encrypted chats from this browser, for good. */
export async function wipeDeviceStore(space: string): Promise<void> {
  if (!SPACE.test(space)) throw new Error("invalid store name");
  if (!supported()) return;
  for (const db of connections.get(space) ?? []) db.close();
  connections.delete(space);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName(space));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("storage error"));
    // Another tab still has it open: it goes as soon as that tab lets go.
    request.onblocked = () => resolve();
  });
}

/** For the developer check only: flips one bit in a saved record, as someone with the disk could. */
export async function corruptRecord(space: string, name: string): Promise<void> {
  const db = await open(space);
  const records = () => db.transaction(RECORDS, "readwrite").objectStore(RECORDS);
  const value = (await done<unknown>(records().get(name))) as Uint8Array;
  const bent = value.slice();
  bent[bent.length - 1] = (bent[bent.length - 1] as number) ^ 1;
  await done(records().put(bent, name));
}
