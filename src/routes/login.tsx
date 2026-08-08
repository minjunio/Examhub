import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck } from "lucide-react";
import {
  GROK_PROVIDERS,
  authEnabled,
  signIn,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DoodleBackground } from "@/components/layout/doodle-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign in | ExamHub" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const redirected = useRef(false);

  // Already signed in → home (not dashboard), once
  useEffect(() => {
    if (isPending || !user || redirected.current) return;
    redirected.current = true;
    void navigate({ to: "/", replace: true });
  }, [user, isPending, navigate]);

  function goHome() {
    redirected.current = true;
    try {
      sessionStorage.setItem("examhub.just-signed-in", "1");
    } catch {
      /* ignore */
    }
    // Soft client nav to home — no full reload flicker
    void navigate({ to: "/", replace: true });
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail({
          email,
          password,
          name: name || email.split("@")[0] || "Student",
        });
        toast.success("Account created");
      } else {
        await signInWithEmail({ email, password });
        toast.success("Welcome back");
      }
      // Let session store settle, then home
      await new Promise((r) => setTimeout(r, 200));
      goHome();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
      setLoading(false);
    }
  }

  async function onGoogle() {
    const provider = GROK_PROVIDERS[0];
    if (!provider) {
      toast.error("Google sign-in is not configured");
      return;
    }
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      await signIn(provider.providerId, { callbackURL: "/" });
      await new Promise((r) => setTimeout(r, 150));
      goHome();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  if (isPending) {
    return (
      <div className="relative min-h-dvh w-full overflow-x-hidden">
        <DoodleBackground />
        <div className="relative z-10 flex min-h-dvh items-center justify-center p-4">
          <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-surface/80" />
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="relative min-h-dvh w-full overflow-x-hidden">
        <DoodleBackground />
        <div className="relative z-10 flex min-h-dvh items-center justify-center p-4 text-sm text-fg-muted">
          Taking you home…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full max-w-[100vw] overflow-x-hidden">
      <DoodleBackground />
      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center p-4">
        <Card className="w-full max-w-md overflow-hidden shadow-glow">
          <CardHeader className="items-center text-center">
            <Link to="/" className="mb-2 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-fg">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-display text-xl font-bold text-fg">
                Exam<span className="text-primary">Hub</span>
              </span>
            </Link>
            <CardTitle>
              {mode === "signin" ? "Sign in" : "Create account"}
            </CardTitle>
            <p className="text-sm text-fg-muted">
              Track orders, become a seller, leave reviews
            </p>
          </CardHeader>
          <CardContent className="min-w-0 space-y-5">
            {authEnabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full max-w-full gap-2"
                  disabled={googleLoading || loading}
                  onClick={() => void onGoogle()}
                >
                  <GoogleIcon />
                  {googleLoading ? "Opening Google…" : "Continue with Google"}
                </Button>
                <div className="relative text-center text-xs text-muted">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  <span className="relative bg-surface px-3">or email</span>
                </div>
              </>
            ) : null}

            <form onSubmit={onEmailSubmit} className="min-w-0 space-y-3">
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full"
                    autoComplete="name"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  className="w-full"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in with email"
                    : "Create account"}
              </Button>
            </form>

            <div className="flex items-start gap-2 rounded-xl bg-bg-soft px-3 py-2.5 text-xs text-fg-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                After sign-in you’ll stay on the main page. Open Dashboard or
                Admin from the header when you need them.
              </p>
            </div>

            <p className="text-center text-sm text-fg-muted">
              {mode === "signin" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c6.9 0 8.2-4.8 8.2-7.2 0-.5 0-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.5l3.2 2.3C7.9 7.4 9.8 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 8.2 2.4 4.9 4.5 3.9 7.5z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.8c2.5 0 4.7-.8 6.2-2.3l-3-2.5c-.8.6-1.9 1-3.2 1-3.1 0-5.7-2.1-6.6-4.9l-3.2 2.5c1.4 2.9 4.4 4.9 8.2 4.9z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.1c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2L2.2 7.6C1.5 9 1.1 10.5 1.1 12.1s.4 3.1 1.1 4.5l3.2-2.5z"
      />
    </svg>
  );
}
