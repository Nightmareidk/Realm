import {
  aes256GcmSealer,
  type BlobStore,
  type Bytes,
  fromBase64Url,
  type KeyStore,
  newStorageKey,
  SealedKeyStore,
  toBase64Url,
} from "@realm/e2ee";
import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

/**
 * Where a phone keeps everything for encrypted chats (docs/E2EE.md §10). A random 256-bit
 * storage key lives in the phone's own keystore (Android Keystore, iOS Keychain, this device
 * only, never in a backup). Keys, chat state and saved messages are files sealed with that key
 * using AES-256-GCM. Without the phone's keystore the files are unreadable noise.
 */

const SPACE = /^[A-Za-z0-9-]{1,40}$/;
const keyName = (space: string) => `realm.e2ee.storage-key.${space}`;
const folder = (space: string) => new Directory(Paths.document, "e2ee", space);

/** One sealed record per file. Record names use ":"; file names use "." in its place. */
class FileBlobs implements BlobStore {
  constructor(private readonly dir: Directory) {}

  private file(name: string, suffix = "") {
    return new File(this.dir, `${name.replaceAll(":", ".")}${suffix}`);
  }

  async get(name: string): Promise<Bytes | null> {
    const file = this.file(name);
    return file.exists ? file.bytes() : null;
  }

  async put(name: string, value: Bytes): Promise<void> {
    // Written beside the record and moved into place, so a crash mid-write (or a full disk)
    // never leaves half a record where a whole one was.
    const fresh = this.file(name, ".new");
    fresh.create({ overwrite: true });
    fresh.write(value);
    await fresh.move(this.file(name), { overwrite: true });
  }

  async delete(name: string): Promise<void> {
    const file = this.file(name);
    if (file.exists) file.delete();
  }
}

/**
 * Opens this phone's sealed store for one account (`space` is the account's id), making its
 * storage key on first use.
 */
export async function openDeviceStore(space: string): Promise<KeyStore | null> {
  if (!SPACE.test(space)) throw new Error("invalid store name");
  const dir = folder(space);
  const saved = await SecureStore.getItemAsync(keyName(space));
  let key: Bytes;
  if (saved) {
    key = fromBase64Url(saved);
  } else {
    // No key (a new phone, or the keystore was cleared): anything left in the folder was sealed
    // with a key that is gone for good, so it is removed rather than left to fail later.
    if (dir.exists) dir.delete();
    key = newStorageKey();
    await SecureStore.setItemAsync(keyName(space), toBase64Url(key), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  dir.create({ intermediates: true, idempotent: true });
  return new SealedKeyStore(new FileBlobs(dir), aes256GcmSealer(key));
}

/** Removes an account's keys and saved encrypted chats from this phone, for good. */
export async function wipeDeviceStore(space: string): Promise<void> {
  if (!SPACE.test(space)) throw new Error("invalid store name");
  await SecureStore.deleteItemAsync(keyName(space));
  const dir = folder(space);
  if (dir.exists) dir.delete();
}

/** For the developer check only: flips one bit in a saved record, as someone with the disk could. */
export async function corruptRecord(space: string, name: string): Promise<void> {
  const file = new File(folder(space), name.replaceAll(":", "."));
  const bytes = await file.bytes();
  bytes[bytes.length - 1] = (bytes[bytes.length - 1] as number) ^ 1;
  file.write(bytes);
}
