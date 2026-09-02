# Egyetemi Jegyzetek

Modern, letisztult jegyzetelő webalkalmazás egyetemi hallgatóknak. Az
adatmodell és a teljes UI kliensoldali (nincs SQL adatbázis, nincs saját
szerver kód), de a jegyzetek felhőben (Firebase) is szinkronizálhatók, hogy
bármelyik eszközödről elérd, feltölthesd és mentse is őket egy egyszerű
bejelentkezéssel — lásd lent a „Felhős szinkronizáció beállítása” szakaszt.
Enélkül a beállítás nélkül is elindul az app, de akkor csak a böngésző
`localStorage`-ában tárol (helyben, egy eszközön), JSON export/import
biztonsági mentéssel.

Ez egy futtatható Next.js (App Router) alkalmazás, Tailwind CSS-sel és
kézzel beillesztett shadcn/ui komponensekkel (mivel a `shadcn` CLI
hálózati elérést igényel a generáláshoz, ami ebben a fejlesztői
környezetben nem volt elérhető — funkcionálisan megegyeznek azzal, amit a
CLI generálna).

## Indítás

```bash
npm install
npm run dev
```

Nyisd meg a [http://localhost:3000](http://localhost:3000) címet.

**Fontos:** bejelentkezés/regisztráció képernyő fogad, amint elindítod —
ez a felhős szinkronizáció feltétele. Ha még nem állítottad be a Firebase
kulcsokat a `.env.local` fájlban, egy tájékoztató képernyőt látsz majd
helyette a bejelentkezés helyett — ez normális, kövesd alul a lépéseket.

A build és a lint ellenőrizve lett (`npm run build`, `npm run lint`) —
mindkettő hiba és figyelmeztetés nélkül fut.

## Funkciók

- **Sidebar app-shell** — állandó bal oldali navigáció (félévek → tárgyak
  fa nézet), nincs több oda-vissza "vissza" gombozás.
- **Kezdőlap dashboard** — aktív félév statisztikái, a mai napi óráid (az
  importált órarendből), hiányzás-figyelmeztetések és a legközelebbi
  jegyugráshoz szükséges pontszám tárgyanként, közelgő határidők,
  tárgy-kártyák.
- **Tárgy nézet** — hiányzás számláló (+/-) színes, figyelmeztető
  progress-sávval és toast jelzéssel, ha a maximum közelébe érsz vagy
  túllépted, követelmény lista (típus, határidő, teljesítettség), oktató
  adatai, jegyzet-feed kereséssel és címke-szűréssel.
- **Jegyzetszerkesztő** — Markdown eszköztár (félkövér, dőlt, listák,
  idézet, kód...) + élő előnézet váltó gomb.
- **Markdown megjelenítés** — a jegyzet-feedben és az összes jegyzet
  nézetben is renderelt (nem nyers `**...**`) tartalom.
- **Összes jegyzetem** — félévtől/tárgytól független kereső és
  címke-szűrő az összes jegyzet között.
- **Sötét/világos mód** — rendszerbeállítás követése vagy kézi váltás,
  `next-themes`-szel, a sidebar alján lévő gombbal.
- **Teljes CRUD + törlés megerősítéssel** — félév, tárgy, követelmény,
  oktató adatai, jegyzet — mindegyik szerkeszthető/törölhető, a
  visszavonhatatlan műveletek megerősítő párbeszédablakkal.
- **Toast visszajelzések** — minden mentés/törlés/létrehozás után (jobb
  alsó sarok), `alert()` helyett.
- **JSON export/import** — teljes adatmentés/visszaállítás a sidebar alján.
- **Felhős szinkronizáció (Firebase)** — email+jelszavas bejelentkezés,
  utána minden változás automatikusan mentődik a felhőbe és letöltődik
  bármelyik másik eszközön, ahol ugyanazzal a fiókkal jelentkezel be. A
  sidebar alján egy kis jelző mutatja az állapotot (Szinkronizálva /
  Mentés… / hiba).
- **Naptár + Neptun órarend-import** — a Neptun "Tanóra" exportját (.xlsx)
  beimportálva havi rács vagy lista nézetben látod az órarended, a
  tárgyaidnál felvett ZH/vizsga/beadandó határidőkkel együtt egy helyen.
  Ld. lentebb a [Naptár és Neptun órarend-import](#naptár-és-neptun-órarend-import)
  szakaszt.
- **Egyetemi ZH-naptár importálása** — az egyetem által közzétett,
  intézményi ZH-naptár xlsx-éből tárgykód alapján kereshetsz, és a
  kiválasztott ZH-időpontokat (akár több napos időszakokat is) egy
  kattintással hozzáadhatod a megfelelő tárgyad Követelményeihez.
- **Mobilbarát elrendezés** — kis képernyőn a sidebar kihúzható hamburger
  menüvé alakul, a tartalom teljes szélességben, görgethetően jelenik meg.
- **Pontozás / jegybecslés** — tárgyanként megadható jegyhatár-beosztás
  (alapértelmezetten 59.5/69.5/79.5/89.5 pontnál 2-3-4-5-ös, 110-es
  maximummal, a pluszpontok miatt), a Követelményeknél (ZH, beadandó, stb.)
  beírható elért/max pontszám, és az app kiszámolja, hány pont kell még a
  következő jegyhez, és a hátralévő tételek alapján ez reálisan elérhető-e
  még. Ld. lentebb a [Pontozás és jegybecslés](#pontozás-és-jegybecslés)
  szakaszt.

## Felhős szinkronizáció beállítása (Firebase)

Ahhoz, hogy a jegyzeteid tényleg bármelyik eszközödről elérhetők legyenek,
egy saját, ingyenes Firebase projektet kell létrehoznod — ezt neked kell
megtenned (fiókot senki más nem hozhat létre helyetted), de az alábbi
lépések végigvezetnek rajta. Kb. 10 perc.

### 1. Firebase projekt létrehozása

1. Nyisd meg a [Firebase Console](https://console.firebase.google.com)-t,
   és jelentkezz be a Google-fiókoddal.
2. „Add project” / „Projekt hozzáadása” → adj neki egy nevet (pl.
   `egyetemi-jegyzetek`) → a Google Analytics ajánlatot nyugodtan
   kihagyhatod („Not right now”) → „Create project”.
3. Ez az ingyenes **Spark** csomagban történik — egy személyes
   jegyzetalkalmazás adatforgalma jóval a Spark ingyenes kerete alatt marad.

### 2. Bejelentkezés (Authentication) engedélyezése

1. A bal oldali menüben: **Build → Authentication → Get started**.
2. A „Sign-in method” fülön válaszd az **Email/Password** szolgáltatót →
   kapcsold be az első kapcsolót (Email/Password) → **Save**.

### 3. Adatbázis (Firestore) létrehozása

1. A bal oldali menüben: **Build → Firestore Database → Create database**.
2. Válassz egy hozzád közeli régiót (pl. `eur3 (europe-west)`) — ezt utólag
   már nem lehet megváltoztatni.
3. Indulhatsz „Production mode”-ban is, mert a projekt saját, szigorú
   szabályokat hoz (lásd 4. lépés).

### 4. Biztonsági szabályok feltöltése

1. A Firestore Database oldalon a **Rules** fülön másold be a projekt
   gyökerében található `firestore.rules` fájl teljes tartalmát a
   szerkesztőbe, felülírva az alapértelmezett szöveget.
2. **Publish**. Ez biztosítja, hogy mindenki csak a saját adatait
   érheti el — más felhasználó jegyzeteit senki sem láthatja.

### 5. Webalkalmazás regisztrálása és a kulcsok lekérése

1. A projekt főoldalán (⚙️ **Project settings**) görgess le a „Your apps”
   részhez → kattints a `</>` (Web) ikonra.
2. Adj neki egy becenevet (pl. `egyetemi-jegyzetek-web`) → **Register app**
   → Firebase Hosting-ot **nem** kell bepipálnod.
3. Megjelenik egy `firebaseConfig` objektum kb. így:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "egyetemi-jegyzetek-xxxxx.firebaseapp.com",
     projectId: "egyetemi-jegyzetek-xxxxx",
     storageBucket: "egyetemi-jegyzetek-xxxxx.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890",
   };
   ```
4. A projekt gyökerében másold le a `.env.local.example` fájlt
   `.env.local` néven, és töltsd ki a fenti értékekkel:
   ```bash
   cp .env.local.example .env.local
   ```
5. Indítsd újra a `npm run dev`-et. Ha minden kulcs helyes, a
   bejelentkezés/regisztráció képernyő működni fog — hozz létre egy fiókot,
   és próbáld ki két böngészőablakban (vagy két eszközön) ugyanazzal a
   fiókkal, hogy lásd a valós idejű szinkronizációt.

### Fontos: meglévő helyi adatok

Ha korábban már használtad az appot bejelentkezés nélkül (localStorage-ban
gyűltek a jegyzeteid), az **első bejelentkezéskor/regisztrációkor** ezek az
adatok automatikusan felkerülnek az új fiókodhoz a felhőbe — nem vesznek
el. Ha egy már létező, korábban másik eszközön szinkronizált fiókkal
jelentkezel be, akkor fordítva történik: a felhőben lévő adat lesz a
mérvadó, és felülírja az adott eszköz helyi (localStorage) tartalmát.

## Naptár és Neptun órarend-import

A bal oldali menü **Naptár** pontja alatt egy helyen látod:

- az importált Neptun órarended (elmélet/gyakorlat/labor órák), és
- a tárgyaidnál a **Követelmények** alatt felvett, még nem teljesített
  határidőket (ZH, vizsga, beadandó stb.) — ezek piros **Határidő** jelzéssel
  jelennek meg.

### Órarend importálása a Neptunból

1. Lépj be a Neptunba, és nyisd meg az **Órarend** (Tanóra) menüpontot.
2. Exportáld a listát **.xlsx** formátumban (a Neptun exportgombjával).
3. Az appban kattints a Naptár nézetben az **"Órarend importálása"** gombra,
   és válaszd ki a letöltött fájlt.
4. Az app automatikusan megpróbálja összekapcsolni az importált órákat a
   nálad már felvett tárgyakkal — ehhez a tárgy neve pontosan (kis-nagybetűtől
   eltekintve) egyezzen a Neptunban szereplő tárgynévvel. Amit nem talál meg,
   az szürkén, "nem egyeztetett" óraként jelenik meg — ez nem hiba, csak
   nincs hozzá tárgy az appban.
5. Az importálás ismételhető (pl. új félév vagy frissített órarend esetén);
   a **"Órarend törlése"** gombbal csak az importált órákat törlöd, a
   tárgyaid, jegyzeteid és a határidőid megmaradnak.

**Fontos:** a Neptun "Tanóra" exportja **csak a heti órarendet** tartalmazza
(elmélet/gyakorlat időpontok) — a ZH-k, vizsgák és beadandók dátumait a
Neptun ebben a fájlban nem adja meg. Ezeket felveheted kézzel a **tárgy
oldalán, a Követelmények alatt** (ahogy eddig is), vagy — ha az egyetemed
közzétesz egy intézményi ZH-naptárat — az alábbi importálással is. Bármelyik
úton kerülnek be, onnantól automatikusan megjelennek a Naptárban is, piros
"Határidő" jelöléssel, együtt az órarenddel.

### Egyetemi ZH-naptár importálása

Ha az egyetemed közzéteszi az összes tárgy ZH-időpontjait egy közös,
intézményi xlsx fájlban (tárgykód, tárgynév, ZH1/ZH2/ZH3 dátumok), ezt is
be tudod importálni — nem a saját órarendedet cseréli le, hanem a
kiválasztott ZH-kat adja hozzá a te tárgyaid Követelmények listájához:

1. A Naptár nézetben kattints az **"Egyetemi ZH-naptár"** gombra, és töltsd
   fel az intézményi ZH-naptár .xlsx fájlját.
2. Keress rá a tárgykódodra vagy a tárgy nevére (legalább 2 karakter).
   Egy tárgykódhoz **több sor is tartozhat** (pl. eltérő nyelvű vagy
   campusú csoportok), ilyenkor mindegyik külön, a csoport-azonosítóval és
   campusszal megkülönböztetve jelenik meg — válaszd ki, amelyik rád
   vonatkozik.
3. Minden találatnál kiválasztható, melyik tárgyadhoz kerüljön (ha a
   tárgykódod pontosan egyezik, ezt az app automatikusan kitölti), és
   jelölőnégyzettel kiválaszthatod, mely ZH-időpontokat (ZH1/ZH2/ZH3) add
   hozzá — egy ZH akár **több napra** (pl. "2026. 10. 08-09." vagy egy
   hónapváltós "2026. 11. 30 - 12. 01." időszakra) is eshet, ilyenkor a
   pontos tartomány a követelmény megjegyzésébe is bekerül.
4. A **"Kiválasztottak hozzáadása"** gombbal a bejelölt ZH-k bekerülnek az
   adott tárgyak Követelmények listájába (Zárthelyi típussal), és onnantól
   a Naptárban is megjelennek.

### Nézetek

- **Havi nézet** — hónapos rács, napi max. 3 esemény chip + "+N további"
  jelzés; egy napra kattintva alul részletes lista jelenik meg az adott nap
  eseményeiről.
- **Lista nézet** — a mai naptól kezdve időrendben, naponta csoportosítva
  listázza az összes közelgő órát és határidőt.

## Pontozás és jegybecslés

Minden tárgy Követelmények & infók fülén megjelenik egy **"Pontozás"**
kártya, ami segít nyomon követni, hol állsz a jegy szempontjából:

1. A kártya **"Szerkesztés"** gombjával tárgyanként beállíthatod:
   - az elméletileg elérhető **max. összpontszámot** (ha vannak
     pluszpontszerzési lehetőségek, ez lehet 100 fölötti is, pl. 110 —
     alapértelmezésben ez van beállítva),
   - a **jegyhatárokat** (hány ponttól jár a 2-es/3-as/4-es/5-ös —
     alapértelmezésben 59.5 / 69.5 / 79.5 / 89.5 pont, de ez
     tárgyanként felülírható, mert nem minden tárgynál egyforma),
   - egy szabad szöveges **megjegyzést**, amibe beírhatod, az adott
     tárgynál hogyan és mikor szerezhetők (plusz)pontok — pl. hogy egy
     ZH-n elért eredmény hány pluszpontot ér, vagy hogy órai
     aktivitásért mennyi jár. Ez tárgyanként más és más lehet, ezért
     tárgyanként külön szerkeszthető.
2. Egy-egy Követelmény (pl. ZH, beadandó, vizsga) szerkesztésekor az
   **"Elért pont"** és **"Max. pont"** mezőkbe beírhatod, hány pontot
   kaptál, illetve hány volt elérhető — mindkettő opcionális, elég
   akkor kitölteni, amikor megvan az eredmény.
3. A Pontozás kártya ez alapján automatikusan mutatja:
   - az eddig **megszerzett pontok összegét** és a becsült **jelenlegi
     jegyet**,
   - hogy a **következő jegyhez** még hány pont hiányzik, és — a még
     nem osztályozott tételek meghirdetett max. pontszáma alapján —
     hogy ez **reálisan elérhető-e még**, vagy a jelenlegi tételekkel
     már nem (pluszpontok nélkül).

## Élesítés (deploy) Vercelre — hogy tényleg bárhonnan elérd

A fenti Firebase-beállítás csak a szinkronizációt oldja meg — ahhoz, hogy
bármelyik eszköz böngészőjéből meg is tudd nyitni az appot (ne csak a saját
gépeden futó `npm run dev`-vel), fel kell tenned egy publikus címre. A
[Vercel](https://vercel.com) (a Next.js készítőjének ingyenes hosting
szolgáltatása) erre a legegyszerűbb.

1. Telepítsd a Vercel parancssori eszközt (csak egyszer kell):
   ```bash
   npm install -g vercel
   ```
2. A projekt mappájában jelentkezz be (ez megnyit egy böngészőablakot / egy
   emailben kapott kódot kér — kövesd az utasításokat):
   ```bash
   vercel login
   ```
3. Indítsd el a telepítést, és válaszolj a kérdésekre (alapértelmezettek
   jók: „Set up and deploy?” → Yes, „Link to existing project?” → No, a
   projekt neve maradhat az ajánlott):
   ```bash
   vercel
   ```
4. Ez létrehoz egy próba (`preview`) URL-t. Mielőtt élesítenéd, add hozzá a
   Firebase kulcsaidat a Vercel projekt beállításaiban is — a `.env.local`
   fájl NEM kerül fel automatikusan: nyisd meg a
   [Vercel Dashboard](https://vercel.com/dashboard)-ot → a projekted →
   **Settings → Environment Variables** → add hozzá egyenként mind a hat
   `NEXT_PUBLIC_FIREBASE_...` kulcsot ugyanazokkal az értékekkel, mint a
   `.env.local`-ban.
5. **Fontos, gyakran kihagyott lépés:** a Firebase Console-ban menj az
   **Authentication → Settings → Authorized domains** oldalra, és add hozzá
   a Vercel által adott domaint (pl. `egyetemi-jegyzetek.vercel.app`) —
   enélkül a bejelentkezés `auth/unauthorized-domain` hibával elutasítja a
   publikus URL-ről érkező kéréseket.
6. Végleges, éles feltöltés:
   ```bash
   vercel --prod
   ```
7. A kapott URL-t (pl. `https://egyetemi-jegyzetek.vercel.app`) bármelyik
   eszközöd böngészőjében megnyithatod, bejelentkezhetsz, és onnantól a
   jegyzeteid mindenhol szinkronban lesznek.

## Tech stack

| Réteg | Választás |
|---|---|
| Keretrendszer | Next.js 16 (App Router, Turbopack) |
| Stílus | Tailwind CSS v4 (`@tailwindcss/typography` a Markdown megjelenítéshez) |
| UI komponensek | shadcn/ui (Radix primitívekre épül, "new-york" stílus) |
| Ikonok | lucide-react |
| Állapotkezelés + perzisztencia | Zustand (`persist` middleware → localStorage) |
| Felhős szinkronizáció | Firebase Authentication (email/jelszó) + Firestore |
| Téma váltás | next-themes |
| Toast értesítések | sonner |
| Markdown renderelés | marked |
| Szerkesztő | Könnyűsúlyú Markdown textarea + előnézet váltó (prototípus) → **Tiptap** vagy **BlockNote** éles verzióban |
| Neptun xlsx beolvasás | `xlsx` (SheetJS) csomag |

> **Megjegyzés a `xlsx` csomagról:** az `npm audit` ismert, jelenleg
> javítás nélküli sebezhetőségeket (prototípus-szennyezés, ReDoS) jelez rá —
> a SheetJS javított kiadásai csak a saját CDN-jükön érhetők el, az npm
> registryn keresztül nem. Mivel a csomagot itt kizárólag a böngészőben, a
> felhasználó saját maga által kiválasztott fájl beolvasására használjuk
> (nem szerveroldalon, nem több felhasználós/bizalmatlan bemenetre), a
> gyakorlati kockázat alacsony — de érdemes tudni róla, és ha kritikus
> lenne, a SheetJS hivatalos CDN-jéről lehet frissebb, javított verziót
> behúzni.

## Projektstruktúra

```
egyetemi-jegyzetek-app/
├── app/
│   ├── layout.tsx                    # Gyökér layout, ThemeProvider, Toaster
│   ├── page.tsx                      # Csak <AppShell /> renderelése
│   └── globals.css                   # Tailwind + shadcn CSS-változók (light/dark) + typography plugin
├── components/
│   ├── ui/                           # shadcn/ui primitívek (button, card, tabs, dialog, alert-dialog, ...)
│   ├── auth/
│   │   └── AuthScreen.tsx            # Bejelentkezés/regisztráció + "Firebase nincs beállítva" képernyő
│   ├── layout/
│   │   ├── AppShell.tsx              # Auth-kapu + nézet-állapotgép (Nezet típus) + fő elrendezés
│   │   ├── Sidebar.tsx               # Félévek/tárgyak fa nézet, téma váltó, export/import, sync jelző, kijelentkezés
│   │   ├── HomeOverview.tsx          # Kezdőlap dashboard
│   │   └── theme-toggle.tsx          # Sötét/világos mód gomb
│   ├── semesters/
│   │   └── SemesterFormDialog.tsx    # Félév létrehozás/szerkesztés
│   ├── subjects/
│   │   ├── SubjectDashboard.tsx      # Tárgy-nézet: hiányzás, követelmények, jegyzet-feed
│   │   ├── SubjectFormDialog.tsx     # Tárgy létrehozás/szerkesztés (szín + ikon választó)
│   │   ├── ProfessorDialog.tsx       # Oktató adatainak szerkesztése
│   │   └── RequirementDialog.tsx     # Követelmény létrehozás/szerkesztés
│   └── notes/
│       ├── NoteEditor.tsx            # Jegyzetíró/-szerkesztő Markdown eszköztárral + előnézet
│       ├── GlobalNotes.tsx           # Összes jegyzetem — kereső + címke-szűrő
│       └── MarkdownContent.tsx       # Renderelt Markdown megjelenítő komponens
├── lib/
│   ├── store.ts                      # Zustand store — CRUD, export/import
│   ├── firebase.ts                   # Firebase app/auth/Firestore inicializálás env-változókból
│   ├── auth.ts                       # Bejelentkezési állapot (useAuthStatus) + auth műveletek
│   ├── cloud-sync.ts                 # Kétirányú Firestore szinkron (useCloudSync, useSyncStatus)
│   ├── markdown.ts                   # renderMarkdown() — marked wrapper
│   ├── subject-icons.ts              # Választható tárgy-ikonok
│   └── utils.ts                      # cn(), formatDateHu(), parseTags()...
├── types/
│   └── index.ts                      # Semester, Subject, Note, Requirement
├── firestore.rules                   # Firestore biztonsági szabályok (csak saját uid alatt)
├── .env.local.example                # Firebase kulcsok sablonja (másold .env.local néven)
└── components.json                   # shadcn/ui konfiguráció (referenciaként)
```

## Adatmodell (röviden)

- **Semester (Félév)** — pl. „2026/2027 Ősz", `aktiv` flag jelöli a jelenlegit.
- **Subject (Tárgy)** — egy félévhez tartozik; név, kód, szín, ikon, oktató
  adatai, hiányzás számláló, követelmény lista.
- **Note (Jegyzet)** — egy tárgyhoz tartozik; cím, típus (Előadás/Gyakorlat/
  Labor/Egyéb), dátum, Markdown tartalom, címkék (`#vizsgakérdés` stb.).
- **Requirement (Követelmény)** — ZH, beadandó, vizsga vagy egyéb, határidővel
  és teljesítettség jelzővel.

Minden típus a `types/index.ts`-ben van definiálva.

## Perzisztencia & biztonsági mentés

A `lib/store.ts` egy Zustand store-t exportál (`useAppStore`), amit a
`persist` middleware automatikusan szinkronban tart a `localStorage`
`egyetemi-jegyzetek-storage` kulcsával — minden módosítás azonnal
perzisztálódik.

```ts
import { downloadJsonBackup, importJsonBackup } from "@/lib/store";

downloadJsonBackup(); // "Biztonsági mentés" gomb — letölti a JSON-t
const result = await importJsonBackup(file); // "Adatok importálása" gomb
```

## Tiptap/BlockNote integrációs pont

A `components/notes/NoteEditor.tsx`-ben a `tartalom` state és a
`<Textarea>` az egyetlen hely, amit le kell cserélni éles verzióban: a
Markdown gyorsgombokat adó `insertMarkdown()` függvény és a textarea
helyett egy Tiptap `<EditorContent editor={editor} />`-t kell beilleszteni.
A store és a többi komponens semmilyen módosítást nem igényel, mert a
`Note.tartalom` mindkét esetben egyszerű string.

## Megjegyzés a shadcn/ui komponensekről

A `components/ui/*.tsx` fájlok a hivatalos shadcn/ui ("new-york" stílus,
Radix-alapú) forráskódját követik kézzel beillesztve — funkcionálisan
megegyeznek azzal, amit a `npx shadcn add ...` parancs generálna. Ha a
saját gépeden van hálózati elérésed a `ui.shadcn.com`-hoz, bármikor
lecserélheted őket a hivatalos CLI kimenetére:

```bash
npx shadcn@latest add button card tabs progress badge input textarea select dropdown-menu checkbox dialog alert-dialog label --overwrite
```

## Ismert korlátozás

Az alkalmazás jelenleg egyetlen, kliens-oldali állapotgéppel (`Nezet`
típus az `AppShell.tsx`-ben) váltogatja a nézeteket ahelyett, hogy valódi
Next.js dinamikus route-okat (`/targy/[id]` stb.) használna — vagyis a
böngésző URL-je nem változik nézetváltáskor, és nincs mélylinkelés vagy
"vissza" gomb támogatás a böngésző szintjén. Ez tudatos, kockázat
csökkentő döntés volt ebben a fejlesztési fázisban; ha szükséges, a
későbbiekben átalakítható valódi route-okra anélkül, hogy a store vagy az
adatmodell módosulna.

## Fejlesztői mód jelző

A `next.config.ts`-ben a `devIndicators: false` beállítás ki van
kapcsolva, mert a fejlesztői build alapértelmezett bal-alsó sarokban
megjelenő "N" jelzője átfedésbe került a Sidebar alján lévő téma váltó és
export/import gombokkal. Ez a beállítás csak a `npm run dev` futtatást
érinti, éles buildben nincs hatása.
