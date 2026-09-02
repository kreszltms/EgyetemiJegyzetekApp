"use client";

import { useState } from "react";
import { CloudOff, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginWithEmail,
  registerWithEmail,
  resetPasswordFor,
  translateAuthError,
} from "@/lib/auth";

type Mode = "login" | "register";

/**
 * Bejelentkező/regisztrációs képernyő. Az egész app emögé van zárva —
 * a jegyzetek felhős szinkronizációjához be kell jelentkezni, mert az
 * adatok a bejelentkezett felhasználó Firebase UID-je alatt szinkronizálódnak
 * eszközök között.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password);
        toast.success("Fiók létrehozva! Mostantól minden eszközödön szinkronizálódnak a jegyzeteid.");
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Írd be az email címed a jelszó-visszaállításhoz, majd kattints újra.");
      return;
    }
    try {
      await resetPasswordFor(email.trim());
      toast.success("Elküldtük a jelszó-visszaállító linket az email címedre.");
    } catch (err) {
      setError(translateAuthError(err));
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">UniNotes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jelentkezz be, hogy az adataid minden eszközödön elérhetők legyenek.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-6">
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === "login"
                  ? "bg-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bejelentkezés
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                mode === "register"
                  ? "bg-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Regisztráció
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email cím</Label>
            <Input
              id="auth-email"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="pl. neptun@hallgato.hu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Jelszó</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Legalább 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Bejelentkezés" : "Fiók létrehozása"}
          </Button>

          {mode === "login" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Elfelejtett jelszó?
            </button>
          )}
        </form>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <CloudOff className="h-3.5 w-3.5" />
          Az adataid biztonságosan, csak a te fiókodhoz kötve tárolódnak.
        </p>
      </div>
    </div>
  );
}

/**
 * Ez a képernyő jelenik meg, ha a .env.local még nincs kitöltve Firebase
 * kulcsokkal — enélkül a bejelentkezés nem tud működni.
 */
export function FirebaseNotConfiguredScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <CloudOff className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">A felhős szinkronizáció még nincs beállítva</h1>
        <p className="text-sm text-muted-foreground">
          A `.env.local` fájlban hiányoznak a Firebase konfigurációs kulcsok.
          Kövesd a <code className="rounded bg-muted px-1 py-0.5">README.md</code>{" "}
          „Felhős szinkronizáció beállítása (Firebase)” szakaszát, majd indítsd
          újra az alkalmazást.
        </p>
      </div>
    </div>
  );
}
