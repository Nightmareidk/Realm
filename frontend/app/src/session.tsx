import type { AuthResult, RegisterBody, SelfUser, ThemeAccent } from "@realm/contracts";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { live } from "./live";
import { api, setSessionToken, whenSessionEnds } from "./server";
import { useTheme } from "./theme";

/** The session token lives in the OS keychain (Android Keystore), never in plain storage. */
const TOKEN_KEY = "realm.session";

/**
 * Where the token is kept: the keychain on a phone, readable only while the phone is unlocked
 * and never copied to a backup or a new phone (signing in again there is the safe way). The
 * browser preview of the app (development only) has no keychain, so it uses the browser's
 * storage instead.
 */
const tokenStore =
  Platform.OS === "web"
    ? {
        getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        deleteItemAsync: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : {
        getItemAsync: (k: string) => SecureStore.getItemAsync(k),
        setItemAsync: (k: string, v: string) =>
          SecureStore.setItemAsync(k, v, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        deleteItemAsync: (k: string) => SecureStore.deleteItemAsync(k),
      };

type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: SelfUser };

interface SessionApi {
  session: Session;
  signIn(login: string, password: string): Promise<void>;
  register(body: RegisterBody): Promise<void>;
  signOut(): Promise<void>;
  /** Load your account again after changing it (name, picture). */
  refreshUser(): Promise<void>;
  /** Take an account the API just handed back (after confirming your email). */
  setUser(user: SelfUser): void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const { setTheme } = useTheme();

  /** Wear the account's own colour once we know who this is. */
  const adopt = useCallback(
    async (user: SelfUser) => {
      setSession({ status: "signedIn", user });
      const settings = await api<{ accent: ThemeAccent }>("/users/@me/settings").catch(() => null);
      if (settings) setTheme(settings.accent);
    },
    [setTheme],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await tokenStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) return mounted && setSession({ status: "signedOut" });
      setSessionToken(token);
      try {
        const user = await api<SelfUser>("/users/@me");
        if (mounted) await adopt(user);
      } catch {
        // Signed out elsewhere, expired, or offline: start at the introduction either way.
        setSessionToken(null);
        if (mounted) setSession({ status: "signedOut" });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [adopt]);

  // Signed out from another device, or the password changed: forget this session here too.
  useEffect(() => {
    whenSessionEnds(() => {
      setSessionToken(null);
      tokenStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      setSession({ status: "signedOut" });
    });
    return () => whenSessionEnds(null);
  }, []);

  // One live connection while signed in, for messages as they arrive.
  useEffect(() => {
    if (session.status !== "signedIn") return;
    live.start();
    return () => live.stop();
  }, [session.status]);

  const start = useCallback(
    async (result: AuthResult) => {
      if (!result.token) throw new Error("The server didn't hand this app a session.");
      await tokenStore.setItemAsync(TOKEN_KEY, result.token);
      setSessionToken(result.token);
      await adopt(result.user);
    },
    [adopt],
  );

  const value = useMemo<SessionApi>(
    () => ({
      session,
      async signIn(login, password) {
        await start(await api<AuthResult>("/auth/login", { body: { login, password } }));
      },
      async register(body) {
        await start(await api<AuthResult>("/auth/register", { body }));
      },
      async refreshUser() {
        const user = await api<SelfUser>("/users/@me");
        setSession({ status: "signedIn", user });
      },
      setUser(user) {
        setSession({ status: "signedIn", user });
      },
      async signOut() {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        await tokenStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
        setSessionToken(null);
        setSession({ status: "signedOut" });
      },
    }),
    [session, start],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession needs SessionProvider");
  return ctx;
}
