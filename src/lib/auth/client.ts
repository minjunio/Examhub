import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { GROK_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so after a
 * popup sign-in it can't read the session cookie — it authenticates with a
 * bearer token instead (captured from the popup, see `signIn`). The `onRequest`
 * hook attaches that token when present; when deployed (cookie auth) no token
 * is stored, so nothing changes.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/**
 * True when sign-in UI should be shown. On by default (preview via the baked
 * preview client, deployed apps via the injected per-app client); set
 * `VITE_AUTH_ENABLED=false` to force it off (dev user — see `use-current-user`).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The upstream providers to render sign-in buttons for (Google only). */
export { GROK_PROVIDERS };

// ── Live-preview bearer token ────────────────────────────────────────────────
const BEARER_KEY = "grok-auth.bearer-token";

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist a session bearer so partitioned iframes (live preview) keep working
 * after email/password sign-in (which does not go through the OAuth popup).
 * Safe no-op on normal deployments where cookies already work.
 */
export function persistSessionToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  if (!token) return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

/** Message the popup posts back to the opener once sign-in completes. */
type PopupMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

/**
 * Start sign-in with Google (`providerId` from `GROK_PROVIDERS`), federating
 * through the Grok auth broker.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";

  // Only allow known providers (Google). Hard reject anything else.
  if (!GROK_PROVIDERS.some((p) => p.providerId === providerId)) {
    throw new Error("Unsupported sign-in provider");
  }

  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  const hadBearer = Boolean(getBearerToken());
  if (hadBearer || !inLivePreview()) {
    try {
      await authClient.signOut();
    } catch {
      /* proceed */
    }
  }
  setBearerToken(null);

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for Google sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    try {
      await authClient.getSession();
    } catch {
      /* session store will recover on next useSession fetch */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (
        dest.origin !== here.origin ||
        dest.pathname !== here.pathname ||
        dest.search !== here.search
      ) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Email/password sign-in that also stores the bearer for live-preview iframes
 * (partitioned cookies alone often fail there).
 */
export async function signInWithEmail(opts: {
  email: string;
  password: string;
}): Promise<void> {
  const res = await authClient.signIn.email({
    email: opts.email.trim(),
    password: opts.password,
  });
  if (res.error) {
    throw new Error(res.error.message || "Sign in failed");
  }
  // Prefer full token from headers if the client surfaces it; fall back to body.
  const token =
    (res.data as { token?: string } | null | undefined)?.token ?? null;
  if (token) persistSessionToken(token);
  try {
    await authClient.getSession();
  } catch {
    /* ignore */
  }
}

export async function signUpWithEmail(opts: {
  email: string;
  password: string;
  name: string;
}): Promise<void> {
  const res = await authClient.signUp.email({
    email: opts.email.trim(),
    password: opts.password,
    name: opts.name.trim() || opts.email.split("@")[0] || "Student",
  });
  if (res.error) {
    throw new Error(res.error.message || "Sign up failed");
  }
  const token =
    (res.data as { token?: string } | null | undefined)?.token ?? null;
  if (token) persistSessionToken(token);
  // Some configs require a separate sign-in after sign-up
  if (!token) {
    await signInWithEmail({ email: opts.email, password: opts.password });
    return;
  }
  try {
    await authClient.getSession();
  } catch {
    /* ignore */
  }
}

function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/** Sign out of THIS app's local session, clear the preview token, then redirect. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    const { clearSessionUserCache } = await import("./use-current-user");
    clearSessionUserCache();
    sessionStorage.removeItem("examhub.is-admin");
    sessionStorage.removeItem("examhub.just-signed-in");
  } catch { /* ignore */ }

  try {
    await authClient.signOut();
  } finally {
    setBearerToken(null);
  }
  window.location.href = redirectTo;
}
