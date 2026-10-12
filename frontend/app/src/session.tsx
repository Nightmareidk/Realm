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
import { api, setSessionToken } from "./server";
import { useTheme } from "./theme";

/** The session token lives in the OS keychain (Android Keystore), never in plain storage. */
const TOKEN_KEY = "realm.session";

type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: SelfUser };

interface SessionApi {
  session: Session;
  signIn(login: string, password: string): Promise<void>;
  register(body: RegisterBody): Promise<void>;
  signOut(): Promise<void>;
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
    let live = true;
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) return live && setSession({ status: "signedOut" });
      setSessionToken(token);
      try {
        const user = await api<SelfUser>("/users/@me");
        if (live) await adopt(user);
      } catch {
        // Signed out elsewhere, expired, or offline: start at the introduction either way.
        setSessionToken(null);
        if (live) setSession({ status: "signedOut" });
      }
    })();
    return () => {
      live = false;
    };
  }, [adopt]);

  const start = useCallback(
    async (result: AuthResult) => {
      if (!result.token) throw new Error("The server didn't hand this app a session.");
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
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
      async signOut() {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
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
