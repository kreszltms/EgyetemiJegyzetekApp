import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// ============================================================================
// UNINOTES — Firebase Admin (SZERVER OLDALI, csak Route Handlerben)
//
// SOHA ne importáld ezt egy "use client" fájlból vagy kliens komponensből —
// a szolgáltatásfiók (service account) privát kulcsát tartalmazza, aminek a
// böngészőben nincs keresnivalója. Ez a modul kizárólag az
// app/api/cron/email-reminders/route.ts Route Handlerből használatos, ahol
// az admin SDK a Firestore biztonsági szabályokat (firestore.rules)
// megkerülve minden felhasználó `userData/{uid}` dokumentumát olvashatja —
// erre van szükség, hogy a napi ütemezett feladat végig tudjon menni az
// összes felhasználón, nem csak a saját bejelentkezett fiókján.
//
// A szükséges három env-változó (FIREBASE_ADMIN_PROJECT_ID,
// FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY) a Firebase
// Console → Project settings → Service accounts → "Generate new private
// key" gombbal letöltött JSON fájlból származik — lásd README.md.
// ============================================================================

let adminApp: App | undefined;

function ensureAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // A Vercel env-változó UI-ban a sortörések "\n" escape-elt formában
  // tárolódnak — vissza kell alakítani valódi sortöréssé, különben a kulcs
  // érvénytelennek tűnik a Firebase Admin SDK számára.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Hiányzó Firebase Admin env-változó(k): FIREBASE_ADMIN_PROJECT_ID / " +
        "FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY. " +
        "Lásd README.md → Email-emlékeztetők beállítása."
    );
  }

  adminApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return adminApp;
}

/** Lazy Firestore Admin példány — csak akkor inicializál, amikor először kell. */
export function getAdminDb(): Firestore {
  return getFirestore(ensureAdminApp());
}

/** Lazy Auth Admin példány — a felhasználók email címének lekérdezéséhez. */
export function getAdminAuth(): Auth {
  return getAuth(ensureAdminApp());
}
