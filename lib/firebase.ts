// ============================================================================
// EGYETEMI JEGYZETEK — Firebase inicializálás
// A felhős szinkronizáció (bejelentkezés + Firestore) csak akkor működik, ha
// a .env.local fájlban meg vannak adva a saját Firebase projekted kulcsai.
// Enélkül az app "helyi módban" fut tovább — lásd README.md.
// ============================================================================

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Igaz, ha minden szükséges Firebase env-változó ki van töltve. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

function ensureApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

/** Lazy Auth példány — csak akkor hozza létre, amikor először kell. */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
  }
  return authInstance;
}

/**
 * Lazy Firestore példány. `ignoreUndefinedProperties: true`, mert az
 * adatmodellben sok opcionális mező van (pl. `hatarido?`), amit a Firestore
 * SDK `undefined` értékkel nem fogadna el.
 */
export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = initializeFirestore(ensureApp(), {
      ignoreUndefinedProperties: true,
    });
  }
  return dbInstance;
}
