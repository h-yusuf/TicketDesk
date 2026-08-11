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
    <div className="max-w-sm mx-auto mt-16 p-6 border rounded">
      <h1 className="text-xl font-semibold mb-4">ReqFlow</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-2 py-1"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-1">
          {mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm text-blue-600 mt-2"
      >
        {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
      </button>
      <button
        type="button"
        onClick={() => signInGoogle().catch((err) => setError(err.message))}
        className="mt-4 border rounded px-3 py-1 w-full"
      >
        Continue with Google
      </button>
    </div>
  );
}
