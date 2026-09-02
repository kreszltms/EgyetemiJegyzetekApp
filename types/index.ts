// ============================================================================
// EGYETEMI JEGYZETEK — Típusdefiníciók
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
// Teljes alkalmazás-állapot / export-import séma
// ----------------------------------------------------------------------------
export interface AppData {
  semesters: Semester[];
  subjects: Subject[];
  notes: Note[];
  /** Neptunból importált órarendi események (opcionális — régebbi
   * exportokban/felhő-dokumentumokban még nem szerepel). */
  scheduleEvents?: ScheduleEvent[];
  /** Séma verzió a jövőbeli migrációkhoz */
  version: string;
  exportedAt?: string;
}

/** Aktuális adatséma verziója — importáláskor ellenőrizhető */
export const DATA_SCHEMA_VERSION = "1.0.0";
