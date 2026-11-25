import { useState, type FormEvent } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Theme } from "@/hooks/useTheme";

interface AuthScreenProps {
  onSignup: (email: string, password: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  theme: Theme;
  onToggleTheme: () => void;
}

export function AuthScreen({ onSignup, onLogin, theme, onToggleTheme }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await (mode === "signup" ? onSignup(email, password) : onLogin(email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setError("");
  }

  return (
    <main className="app auth">
      <header className="header">
        <div className="header__text">
          <p className="eyebrow">Huddle</p>
          <h1 className="title">{mode === "login" ? "Sign in" : "Create account"}</h1>
          <p className="date">Your tasks, private and shared</p>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <form className="auth__form" onSubmit={handleSubmit}>
        <div className="auth__field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>

        <div className="auth__field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            maxLength={128}
          />
        </div>

        {error && (
          <p className="auth__error" role="alert">
            {error}
          </p>
        )}

        <button className="auth__submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="auth__switch">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button type="button" onClick={switchMode}>
          {mode === "login" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
    </main>
  );
}
