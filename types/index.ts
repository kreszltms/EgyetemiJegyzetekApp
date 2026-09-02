// ============================================================================
// UNINOTES — Típusdefiníciók
// 100% kliensoldali adatmodell. Nincs backend, nincs SQL adatbázis.
// Minden adat a böngészőben (localStorage / IndexedDB) tárolódik.
// ============================================================================

/** Támogatott témák a felületen */
export type Theme = "light" | "dark" | "system";

// ----------------------------------------------------------------------------
// Oktató adatai
// ----------------------------------------------------------------------------
export interface Professor {
  nev: string;
  email: string;
  fogadoora: string;
}

// ----------------------------------------------------------------------------
// Hiányzás számláló
// ----------------------------------------------------------------------------
export interface AttendanceInfo {
  /** Maximálisan engedélyezett hiányzások száma (pl. 3) */
  maxHianyzas: number;
  /** Eddig felhasznált hiányzások száma */
  jelenlegiHianyzas: number;
}

// ----------------------------------------------------------------------------
// Követelmények (ZH-k, beadandók, vizsgák stb.)
// ----------------------------------------------------------------------------
export type RequirementType = "zh" | "beadando" | "vizsga" | "egyeb";

export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  zh: "Zárthelyi",
  beadando: "Beadandó",
  vizsga: "Vizsga",
  egyeb: "Egyéb",
};

export interface Requirement {
  id: string;
  nev: string;
  tipus: RequirementType;
  /** ISO dátum string (YYYY-MM-DD), opcionális */
  hatarido?: string;
  teljesitve: boolean;
  megjegyzes?: string;
  /** Az ezen a tételen ténylegesen megszerzett pontszám, ha van osztályozva. */
  pontszamSzerzett?: number;
  /** Az ezen a tételen maximálisan megszerezhető pontszám (pl. "ez a ZH 20 pontot ér"). */
  pontszamMax?: number;
}

// ----------------------------------------------------------------------------
// Pontozás (féléves összpontszám → érdemjegy átváltás, tárgyanként eltérő)
// ----------------------------------------------------------------------------

/** Egy érdemjegy-határ: "ettől a pontszámtól ez a jegy jár". */
export interface PontHatar {
  /** Érdemjegy (jellemzően 2-5; az 1-es az összes határ alatti tartomány). */
  jegy: number;
  /** Minimálisan szükséges összpontszám ehhez a jegyhez. */
  minPont: number;
}

export interface PontozasConfig {
  /** A félévben elméletileg elérhető legmagasabb összpontszám (pluszpontokkal együtt). */
  maxOsszpontszam: number;
  /** Jegyhatárok, tetszőleges tárgyanként eltérő beosztással. */
  hatarok: PontHatar[];
  /** Szabad szöveges megjegyzés: hogyan/mikor szerezhetők (plusz)pontok ennél a tárgynál. */
  megjegyzes?: string;
}

/**
 * Alapértelmezett jegyhatárok — a leggyakoribb "60-70-80-90%-os" beosztás,
 * fél pontos pufferrel, 110 pontos (pluszpontos) maximummal. Tárgyanként
 * szabadon módosítható, mert egyetemenként/tárgyanként eltérhet.
 */
export const DEFAULT_PONTOZAS: PontozasConfig = {
  maxOsszpontszam: 110,
  hatarok: [
    { jegy: 2, minPont: 59.5 },
    { jegy: 3, minPont: 69.5 },
    { jegy: 4, minPont: 79.5 },
    { jegy: 5, minPont: 89.5 },
  ],
  megjegyzes: "",
};

// ----------------------------------------------------------------------------
// Tárgy (Subject)
// ----------------------------------------------------------------------------
export interface Subject {
  id: string;
  semesterId: string;
  nev: string;
  kod: string;
  /** Tailwind-kompatibilis hex szín, pl. "#6366f1" */
  szin: string;
  /** Lucide ikon neve, pl. "BookOpen", "FlaskConical", "Calculator" */
  ikon: string;
  oktato: Professor;
  hianyzas: AttendanceInfo;
  kovetelmenyek: Requirement[];
  /**
   * Opcionális — régebben létrehozott tárgyaknál (localStorage-ban vagy a
   * felhőben) hiányozhat. Mindig a `subject.pontozas ?? DEFAULT_PONTOZAS`
   * mintával olvasandó, sosem feltételezve, hogy biztosan jelen van.
   */
  pontozas?: PontozasConfig;
  /**
   * A tárgy kreditértéke a kreditindex-számításhoz. Opcionális — régebbi
   * tárgyaknál hiányozhat, ilyenkor `subject.kredit ?? 0`-ként olvasandó,
   * és a kreditindex-számítás kihagyja (nem osztunk 0-val súlyozva).
   */
  kredit?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Jegyzet (Note)
// ----------------------------------------------------------------------------
export type NoteCategory = "eloadas" | "gyakorlat" | "labor" | "egyeb";

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  eloadas: "Előadás",
  gyakorlat: "Gyakorlat",
  labor: "Labor",
  egyeb: "Egyéb",
};

/**
 * Egy jegyzethez csatolt kép — mivel az egész alkalmazásállapot egyetlen
 * Firestore dokumentumban tárolódik (lásd lib/cloud-sync.ts), és annak kb.
 * 1 MB-os mérethatára van, a képeket feltöltéskor kliensoldalon
 * (canvas-szal) tömörítjük, és data URL-ként tároljuk itt — nincs külön
 * fájltárolás/backend.
 */
export interface NoteAttachment {
  id: string;
  /** Tömörített kép, "data:image/jpeg;base64,…" formában. */
  dataUrl: string;
  /** Az eredeti fájl neve, megjelenítéshez. */
  nev: string;
  /** A tömörített data URL hossza bájtban (becslés a UI-hoz). */
  meret: number;
}

/**
 * Egy korábbi pillanatkép egy jegyzet cím+tartalom mezőjéről — a
 * verziótörténet ("Előzmények") funkcióhoz. Szándékosan CSAK cím+tartalom,
 * a mellékletek nem verziózottak, mert azok (tömörítve is) akár
 * több száz KB-ot is jelenthetnek, és minden mentésnél újra eltárolva
 * gyorsan szétfeszítenék a Firestore ~1 MB-os dokumentumkorlátját.
 */
export interface NoteVersion {
  id: string;
  /** ISO dátum-idő string — mikor készült ez a pillanatkép. */
  mentveKor: string;
  cim: string;
  tartalom: string;
}

/** Jegyzetenként legfeljebb ennyi korábbi verziót tartunk meg — a
 * legrégebbi törlődik, ha betelik (lásd lib/store.ts updateNote). */
export const MAX_NOTE_VERSIONS = 15;

export interface Note {
  id: string;
  subjectId: string;
  cim: string;
  tipus: NoteCategory;
  /** ISO dátum string (YYYY-MM-DD) */
  datum: string;
  /** Markdown-kompatibilis szöveges tartalom (Tiptap/BlockNote kimenet) */
  tartalom: string;
  /** Címkék "#" nélkül tárolva, pl. ["vizsgakérdés", "definíció"] */
  cimkek: string[];
  /**
   * Csatolt képek — opcionális, régebbi jegyzeteknél hiányozhat, ilyenkor
   * `note.mellekletek ?? []`-ként olvasandó. Sosem `undefined`-ként írjuk
   * (Firestore nem fogadja el undefined mezőértékként), mindig `[]`.
   */
  mellekletek?: NoteAttachment[];
  /**
   * Korábbi cím+tartalom pillanatképek (legrégebbi elöl) — opcionális,
   * régebbi jegyzeteknél hiányozhat, ilyenkor `note.verziok ?? []`-ként
   * olvasandó. Lásd NoteVersion doc-komment a tervezési korlátokról.
   */
  verziok?: NoteVersion[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Félév (Semester)
// ----------------------------------------------------------------------------
export interface Semester {
  id: string;
  /** pl. "2026/2027 Ősz" */
  nev: string;
  aktiv: boolean;
  kezdoDatum?: string;
  zaroDatum?: string;
  createdAt: string;
  /**
   * Lezárt/archivált félév — opcionális, régebbi féléveknél hiányozhat,
   * ilyenkor `semester.archivalt ?? false`-ként olvasandó. Az archivált
   * félévek a Kezdőlapon/oldalsávon és a Kreditindex nézeten alapból
   * összecsukva jelennek meg, hogy a friss félévek maradjanak fókuszban —
   * az adatuk (tárgyak, jegyek) továbbra is megmarad és beleszámít a
   * kumulált kreditindexbe.
   */
  archivalt?: boolean;
}

// ----------------------------------------------------------------------------
// Órarendi esemény (Neptun "Tanóra" xlsx exportból importálva)
// ----------------------------------------------------------------------------
/** Ugyanaz a kategorizálás, mint a jegyzeteknél — a Neptun "Kurzus típus"
 * mezője (Elmélet/Gyakorlat/Labor) erre képződik le. */
export type ScheduleEventType = NoteCategory;

export interface ScheduleEvent {
  id: string;
  /** A Neptun export "Név" mezője, pl. "Hálózati infrastruktúrák" */
  cim: string;
  tipus: ScheduleEventType;
  /** ISO datetime string (pl. "2026-09-07T12:00:00") */
  kezdes: string;
  /** ISO datetime string */
  befejezes: string;
  kurzuskod?: string;
  oktato?: string;
  terem?: string;
  /** Ha a "Név" egyezik egy meglévő Subject nevével, ide kerül az ID —
   * ekkor az esemény a tárgy színét/ikonját örökli a naptárban. */
  subjectId?: string;
}

// ----------------------------------------------------------------------------
// Email-emlékeztetők (Vercel Cron + Resend háttérfolyamat küldi)
// ----------------------------------------------------------------------------
/**
 * A felhasználó email-emlékeztető beállítása — ez maga a beállítás
 * (kliensen szerkeszthető, a felhő-szinkronnal együtt utazik). A tényleges
 * küldés egy szerver oldali ütemezett feladat dolga (lásd
 * app/api/cron/email-reminders/route.ts), ami naponta egyszer lefut,
 * beolvassa ezt a mezőt minden felhasználónál, és a közelgő ZH/vizsga
 * határidőkről (Requirement, tipus "zh" vagy "vizsga") emailt küld a
 * Firebase Auth fiókhoz tartozó címre — nem itt, kliensoldalon történik a
 * küldés, hiszen böngésző nélkül, zárt laptop mellett is meg kell történnie.
 */
export interface EmailReminderSettings {
  enabled: boolean;
  /** Hány nappal a határidő előtt (és az alatt) kapjon emailt. */
  napokElotte: number;
}

export const DEFAULT_EMAIL_REMINDER_NAPOK_ELOTTE = 3;

export const DEFAULT_EMAIL_REMINDER_SETTINGS: EmailReminderSettings = {
  enabled: false,
  napokElotte: DEFAULT_EMAIL_REMINDER_NAPOK_ELOTTE,
};

// ----------------------------------------------------------------------------
// Teljes alkalmazás-állapot / export-import séma
// ----------------------------------------------------------------------------
export interface AppData {
  semesters: Semester[];
  subjects: Subject[];
  notes: Note[];
  /** Neptunból importált órarendi események (opcionális — régebbi
   * exportokban/felhő-dokumentumokban még nem szerepel). */
  scheduleEvents?: ScheduleEvent[];
  /**
   * A diplomához/oklevélhez szükséges összes kredit (a Kreditindex nézet
   * "Diplomához szükséges kredit" tervezőjéhez) — opcionális, amíg a
   * felhasználó be nem állítja.
   */
  celKredit?: number;
  /** Email-emlékeztető beállítás — opcionális, régebbi exportoknál/felhő-
   * dokumentumoknál hiányozhat, ilyenkor DEFAULT_EMAIL_REMINDER_SETTINGS-ként
   * olvasandó. */
  emailReminders?: EmailReminderSettings;
  /** Séma verzió a jövőbeli migrációkhoz */
  version: string;
  exportedAt?: string;
}

/** Aktuális adatséma verziója — importáláskor ellenőrizhető */
export const DATA_SCHEMA_VERSION = "1.0.0";
