"use client";

import { useSyncExternalStore } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { useAppStore } from "@/lib/store";

// ============================================================================
// EGYETEMI JEGYZETEK — Bejelentkezési állapot
// `useSyncExternalStore`-ral figyeljük a Firebase Auth állapotát — a snapshot
// mindig ugyanazt az objektum-referenciát adja vissza, amíg ténylegesen nem
// változik semmi, hogy elkerüljük a végtelen render-kört (lásd a Zustand
// szelektoroknál tanult ugyanezt a mintát).
// ============================================================================

interface AuthSnapshot {
  /** Van-e egyáltalán kitöltve Firebase konfiguráció (.env.local) */
  configured: boolean;
  /** Megérkezett-e már az első válasz a Firebase-től */
  ready: boolean;
  user: User | null;
}

const configured = isFirebaseConfigured();

// Stabil, egyszer létrehozott referencia — a getServerSnapshot() ugyanezt
// az objektumot adja vissza minden hívásnál, különben `useSyncExternalStore`
// minden render alkalmával új referenciát látna és végtelen render-körbe
// futna (lásd a Zustand szelektoroknál tanult ugyanezt a hibát).
const initialSnapshot: AuthSnapshot = { configured, ready: !configured, user: null };

let state: AuthSnapshot = initialSnapshot;
const listeners = new Set<() => void>();
let initialized = false;

function ensureListening() {
  if (initialized || !configured) return;
  initialized = true;
  onAuthStateChanged(getFirebaseAuth(), (user) => {
    state = { configured: true, ready: true, user };
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void) {
  ensureListening();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthSnapshot {
  return state;
}

function getServerSnapshot(): AuthSnapshot {
  return initialSnapshot;
}

export function useAuthStatus(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ----------------------------------------------------------------------------
// Auth műveletek
// ----------------------------------------------------------------------------

export async function registerWithEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function loginWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

/**
 * Kijelentkezés után töröljük a helyi store tartalmát is (nem csak a
 * Firebase munkamenetet) — így egy közös/megosztott géphez nem marad az
 * előző fiók adata a böngésző localStorage-ában a következő bejelentkezésig.
 */
export async function logout() {
  await signOut(getFirebaseAuth());
  useAppStore.getState().resetAll();
}

export async function resetPasswordFor(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

/** Firebase Auth hibakódokat fordít le magyar, felhasználóbarát szövegre. */
export function translateAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Ez az email cím már regisztrálva van. Próbálj bejelentkezni helyette.";
    case "auth/invalid-email":
      return "Érvénytelen email cím formátum.";
    case "auth/weak-password":
      return "A jelszónak legalább 6 karakter hosszúnak kell lennie.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Hibás email cím vagy jelszó.";
    case "auth/too-many-requests":
      return "Túl sok próbálkozás történt. Kérjük, várj egy kicsit, mielőtt újra próbálkozol.";
    case "auth/network-request-failed":
      return "Nincs internetkapcsolat vagy a Firebase nem elérhető.";
    default:
      return "Váratlan hiba történt. Próbáld újra.";
  }
}
