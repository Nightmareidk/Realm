import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small things this device remembers, like "the tour is done" or "the last version you saw".
 * Never secrets. The phone keeps them in its own storage; the browser preview (development only)
 * in the browser's. Failing to read or write is never an error: at worst something shows again.
 */
export const remember = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async del(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};
