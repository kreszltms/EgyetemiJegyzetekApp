// ============================================================================
// UNINOTES — Firebase inicializálás
// A felhős szinkronizáció (bejelentkezés + Firestore) csak akkor működik, ha
// a .env.local fájlban meg vannak adva a saját Firebase projekted kulcsai.
// Enélkül az app "helyi módban" fut tovább — lásd README.md.
// ============================================================================

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

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
 *
 * TARTÓS (IndexedDB-alapú) HELYI CACHE: enélkül a Firestore SDK alapból
 * csak MEMÓRIÁBAN tartja a még el nem küldött (offline közben keletkezett)
 * írásokat — ha a felhasználó rossz net mellett jegyzetel, majd bezárja
 * vagy újratölti a lapot, mielőtt visszajönne a kapcsolat, ez a még el nem
 * küldött módosítás nyomtalanul elveszne. A `persistentLocalCache` ezt egy
 * IndexedDB-be írt, lap-újratöltést is túlélő várólistával oldja meg.
 *
 * (A `localCache` mezőnek adjuk át a `persistentLocalCache()` eredményét.)
 *
 * `persistentMultipleTabManager()` kell sima (alapértelmezett)
 * egy-fülös kezelő helyett, mert ha a felhasználó UGYANABBAN a
 * böngészőben két fülön is nyitva tartja az appot, anélkül a MÁSODIK fül
 * csendben visszaesne memória-only módba (mivel csak egy fül birtokolhatja
 * az IndexedDB-t egyszerre) — ez pont azt a rést hagyná nyitva, amit itt be
 * akarunk zárni.
 *
 * Ha a tartós cache bekérése bármiért hibázna (pl. Safari privát
 * böngészés, ahol az IndexedDB korlátozott/nem elérhető), a Firestore SDK
 * ezt jellemzően egy konzol-figyelmeztetéssel, csendben memória-cache-re
 * visszaesve kezeli — de a try/catch itt egy plusz védőháló arra az esetre,
 * ha maga az `initializeFirestore` hívás dobna (pl. nem-böngésző
 * környezetben, ahol a `persistentLocalCache` dokumentáltan nem
 * támogatott), hogy az app ilyenkor is legalább memória-cache-sel tovább
 * fusson ahelyett, hogy elszállna.
 */
export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    try {
      dbInstance = initializeFirestore(ensureApp(), {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      dbInstance = initializeFirestore(ensureApp(), {
        ignoreUndefinedProperties: true,
      });
    }
  }
  return dbInstance;
}
