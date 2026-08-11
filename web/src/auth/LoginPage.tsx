import { type FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      if (mode === "login") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-dark">
            Intake Window
          </p>
          <h1 className="font-display text-3xl font-bold mt-2">ReqFlow</h1>
          <p className="text-ink/50 text-sm mt-1">
            From request to resolution.
          </p>
        </div>

        <div className="ticket">
          <div className="ticket-notch-left" />
          <div className="ticket-notch-right" />

          <div className="px-6 pt-4">
            <span className="font-mono text-xs tracking-wide text-ink/50">
              {mode === "login" ? "SIGN IN" : "NEW ACCOUNT"}
            </span>
          </div>

          <form
            onSubmit={handleSubmit}
            className="ticket-perforation px-6 pt-4 pb-6 flex flex-col gap-3"
          >
            <label htmlFor="email" className="font-mono text-xs uppercase tracking-wide text-ink/60">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber"
            />

            <label htmlFor="password" className="font-mono text-xs uppercase tracking-wide text-ink/60">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber"
            />

            {error && <p className="text-rust text-sm font-body">{error}</p>}

            <button
              type="submit"
              className="mt-2 bg-amber hover:bg-amber-dark text-navy font-display font-semibold rounded-sm px-3 py-2 transition-colors"
            >
              {mode === "login" ? "Log in" : "Sign up"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-xs font-body text-ink/50 hover:text-ink underline underline-offset-2"
            >
              {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
            </button>

            <button
              type="button"
              onClick={() => signInGoogle().catch((err) => setError(err.message))}
              className="mt-1 border border-ink/20 rounded-sm px-3 py-2 font-body text-sm hover:bg-ink/5 transition-colors"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
