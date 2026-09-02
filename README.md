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
- **Kreditindex** — külön nézet a bal oldali menüben, ami a tárgyaknál
  megadott kredit és a Pontozásból becsült jegyek alapján kiszámolja a
  kredit-súlyozott átlagot, félévenként és összesítve is. Ld. lentebb a
  [Kreditindex](#kreditindex) szakaszt.
- **Félévek archiválása** — egy lezárt félév a sidebar "..." menüjéből
  archiválható, ezután alapból összecsukva, egy külön "Archívum" csoportban
  jelenik meg (a sidebarban és a Kreditindex nézeten is), hogy a friss
  félévek maradjanak fókuszban. Az archivált félév adata nem vész el —
  bármikor visszaállítható, és a kreditindex-számításba is beleszámít. Ld.
  lentebb a [Félévek archiválása](#félévek-archiválása) szakaszt.
- **Diplomához szükséges kredit-tervező** — a Kreditindex nézeten megadható,
  hány kredit kell összesen az okleveledhez; onnantól egy sáv mutatja, hol
  tartasz, és a félévenkénti tempód alapján durván megbecsüli, kb. hány
  féléved van még hátra. Ld. lentebb a
  [Diplomához szükséges kredit-tervező](#diplomához-szükséges-kredit-tervező)
  szakaszt.
- **Jegytrend** — a Kreditindex nézeten egy grafikon mutatja, hogyan alakult
  a kredit-súlyozott féléves átlagod időben, hogy lásd a tendenciát, nem
  csak egy pillanatnyi számot.
- **.ics naptár-export** — a Naptár nézeten egy kattintással exportálhatod az
  órarended és a nyitott határidőidet egy szabványos `.ics` fájlba, amit
  beimportálhatsz a saját (Google/Apple/Outlook) naptáradba. Ld. lentebb az
  [.ics naptár-export](#ics-naptár-export) szakaszt.
- **Emlékeztetők közelgő határidőkre** — a sidebar alján egy haranggal
  bekapcsolható böngésző-emlékeztető: amíg az app nyitva van (vagy fókuszba
  kerül), jelez, ha van ma/holnap esedékes, még nyitott határidőd. Ld.
  lentebb az [Emlékeztetők közelgő határidőkre](#emlékeztetők-közelgő-határidőkre)
  szakaszt.
- **Telepíthető (PWA)** — az app manifestje és egy alap service worker miatt
  asztali gépről/telefonról telepíthető, saját ikonnal, és a korábban már
  megnyitott oldalak internet nélkül is betöltődnek. Ld. lentebb a
  [Telepíthető alkalmazás (PWA)](#telepíthető-alkalmazás-pwa) szakaszt.
- **Gyors keresés / parancspaletta** — `Ctrl+K` (vagy `Cmd+K` Mac-en)
  bárhonnan megnyit egy keresőt, amiben nézetek, tárgyak és jegyzetek között
  lehet ugrálni anélkül, hogy a sidebar-ban kellene keresgélni. Ld. lentebb a
  [Gyors keresés](#gyors-keresés--parancspaletta-ctrlk) szakaszt.
- **Jegyzet-mellékletek** — a jegyzetszerkesztőben képet csatolhatsz (pl. a
  táblafotó), amit az app automatikusan tömörít. Ld. lentebb a
  [Jegyzet-mellékletek](#jegyzet-mellékletek) szakaszt.
- **Jegyzet-sablonok** — új, üres jegyzetnél egy kattintással előtölthető
  Markdown-váz (Előadás / Vizsgafelkészülés / Gyakorlat), hogy ne üres lappal
  kelljen indulni.
- **Félév-összefoglaló nyomtatás / PDF export** — a Kreditindex nézeten
  félévenként kinyomtatható (vagy PDF-ként elmenthető) egy áttekintő
  összefoglaló a tárgyakról, jegyekről, kreditekről és hiányzásokról. Ld.
  lentebb a [Félév-összefoglaló nyomtatás](#félév-összefoglaló-nyomtatás--pdf-export)
  szakaszt.
- **.ics naptár-import** — a saját (pl. egyetemi) naptárad `.ics` fájlját is
  beimportálhatod a Naptár nézetbe, az export visszafelé irányaként. Ld.
  lentebb az [.ics naptár-import](#ics-naptár-import) szakaszt.
- **Email-emlékeztetők** — a böngésző-emlékeztetőtől függetlenül, egy
  szerver oldali napi ütemezett feladat emailt küld a közelgő, még nem
  teljesített ZH/vizsga határidőkről — akkor is, ha az app nincs megnyitva.
  Opcionális, külön beállítást igényel. Ld. lentebb az
  [Email-emlékeztetők beállítása (Resend + Vercel Cron)](#email-emlékeztetők-beállítása-resend--vercel-cron)
  szakaszt.
- **Jegyzet-verziótörténet** — a jegyzetszerkesztőben egy óra ikon megnyitja
  a korábbi mentett állapotok listáját, amikből bármelyik egy kattintással
  visszaállítható (a visszaállítás előtti tartalom is megmarad). Ld. lentebb
  a [Jegyzet-verziótörténet](#jegyzet-verziótörténet) szakaszt.

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

## Kreditindex

A bal oldali menü **"Kreditindex"** pontja alatt egy külön nézet mutatja a
kredit-súlyozott átlagodat — félévenkénti bontásban és összesítve is:

- Tárgyanként megadható egy **kreditérték** (a tárgy szerkesztésekor, a
  "Maximális hiányzás" mellett) — ez opcionális, de enélkül az adott tárgy
  nem számít bele az átlagba.
- Az átlaghoz felhasznált **jegy** ugyanaz a Pontozás kártyán becsült
  aktuális érdemjegy, amit a beírt pontok alapján az app számol — tehát ez
  egy élő, folyamatosan frissülő becslés, nem a hivatalos leckekönyvi index.
  Egy tárgy csak akkor számít bele, ha van megadva kreditje **és** már be
  van írva legalább egy pont valamelyik követelményébe; a lista jelzi is,
  ha egy tárgy emiatt (még) kimarad ("nincs kredit" / "nincs pont beírva").
- A nézet tetején egy összesített, az összes félévedet figyelembe vevő
  kreditindex látható, alatta pedig félévenkénti bontásban ugyanez, hogy
  lásd, melyik félévben hogyan állsz.

## Félévek archiválása

Ahogy telnek a félévek, a sidebar és a Kreditindex nézet is egyre
zsúfoltabbá válna, ha minden korábbi félév végig ki lenne listázva. Ezért
egy lezárt félév **archiválható**:

- A sidebarban a félév melletti **"…"** menüben válaszd az **"Archiválás"**
  pontot (ugyanitt vissza is állítható az **"Visszaállítás"** menüponttal).
- Az archivált félévek nem tűnnek el és nem törlődnek — csak egy külön,
  alapból **összecsukott "Archívum"** csoportba kerülnek, a sidebar félév
  listája alján. Rákattintva bármikor kinyitható, és a benne lévő tárgyaid
  ugyanúgy elérhetők, mint korábban.
- Ha épp az aktívan megnyitott félévet archiválod, az app automatikusan a
  következő nem-archivált félévet állítja be aktívnak (ha van ilyen).
- A **Kreditindex** nézeten ugyanez a logika érvényesül: az archivált
  félévek részletes bontása alapból össze van csukva egy "Archivált
  félévek" szakasz alatt, de az **Összesített kreditindexbe** továbbra is
  beleszámítanak — archiválás csak a listázást, nem a számítást
  befolyásolja.

## Diplomához szükséges kredit-tervező

A Kreditindex nézet tetején, az összesített kreditindex mellett egy kártya
segít nyomon követni, hol tartasz a diplomához vezető úton:

- Első alkalommal add meg, hány kredit kell összesen az okleveledhez (pl.
  180 vagy 210 — az intézményed/szakod mintatanterve alapján), a
  "Cél kredit beállítása" gombbal. Bármikor módosítható a kártya jobb felső
  sarkában lévő ceruza ikonnal.
- A kártya a ténylegesen **megszerzett** kreditedet viszonyítja ehhez a
  célhoz. Egy tárgy kreditje csak akkor számít megszerzettnek, ha a
  Pontozásból becsült aktuális jegye **legalább 2-es** — a magyar
  felsőoktatásban elégtelen (1-es) jegyért ugyanis nem jár kredit, még akkor
  sem, ha a tárgynak egyébként van megadva kreditértéke.
- A sáv alatt egy durva becslés is megjelenik, kb. hány félév van hátra a
  jelenlegi tempód mellett (a korábbi féléveid átlagos megszerzett kreditje
  alapján számolva). Ez csak tájékoztató jellegű — nem ismeri a
  mintatanterved pontos kötelező/kötelezően választandó/szabadon választható
  kreditkereteit, egyetlen összesített célszámmal dolgozik.

## Jegytrend

Ugyanezen a nézeten, közvetlenül a kártyák alatt egy grafikon mutatja, hogyan
alakult a kredit-súlyozott féléves átlagod időrendi sorrendben — így nem csak
egy pillanatnyi számot látsz, hanem a tendenciát is. Legalább két félévnyi
beszámítható átlag szükséges hozzá; addig egy rövid üzenet jelzi, hogy még
nincs elég adat.

## .ics naptár-export

A Naptár nézet tetején az **"Exportálás (.ics)"** gombbal egy szabványos
iCalendar (`.ics`) fájlba mentheted a naptáradat — az importált órarended
(Neptunból) és az összes nyitott (még nem teljesített), határidős
követelményed (ZH, beadandó, vizsga) egyben. A letöltött fájlt bármelyik
naptáralkalmazásba (Google Naptár, Apple Naptár, Outlook stb.) beimportálva
onnantól ott is látod ezeket az eseményeket. A tanórák a készülék saját
időzónájában jelennek meg, a határidők egész napos eseményként.

Mivel ez egy egyszeri export (nem élő feed), ha később módosítod az
órarended vagy a határidőidet, újra le kell töltened és be kell importálnod
a friss `.ics` fájlt.

## Emlékeztetők közelgő határidőkre

A sidebar alján, a téma-váltó gomb mellett egy harang ikon kapcsolja be/ki a
böngésző-emlékeztetőket. Bekapcsoláskor a böngésződ rákérdez, engedélyezed-e
az értesítéseket ennek az oldalnak — ha igen, onnantól minden alkalommal,
amikor megnyitod az appot (vagy visszaváltasz rá egy másik fülről), az app
ellenőrzi, van-e ma vagy holnap esedékes, még nyitott határidőd, és ha igen,
egy böngésző-értesítéssel jelez rá (naponta legfeljebb egyszer tételenként,
hogy ne kapj duplán ugyanarra emlékeztetőt).

Fontos korlát: mivel ez egy 100%-ban kliensoldali, backend/push-szerver
nélküli app, az emlékeztető csak akkor tud megjelenni, ha az app ténylegesen
meg van nyitva (vagy legalább egy háttérfülön fut) a böngészőben — nincs
mögötte szerver, ami akkor is tudna push-t küldeni, ha be van zárva az
oldal. Ha ez a korlát zavaró, a fentebbi [.ics naptár-export](#ics-naptár-export)
funkcióval a határidőid átvihetők egy olyan naptáralkalmazásba, amelyik
tud valódi push-emlékeztetőt küldeni.

## Telepíthető alkalmazás (PWA)

Az app egy Web App Manifesttel és egy alap service workerrel rendelkezik,
így telepíthető:

- **Asztali Chrome/Edge**: a címsorban megjelenő telepítés-ikonnal, vagy a
  böngésző menüjéből ("Alkalmazás telepítése").
- **Android**: a Chrome "Kezdőképernyőhöz adás" / "Alkalmazás telepítése"
  menüpontjával.
- **iOS Safari**: a Megosztás menü "Kezdőképernyőhöz adás" pontjával (ekkor
  saját ikonnal, teljes képernyős módban indul, böngészősáv nélkül).

Telepítve az app saját ablakban/ikonnal fut. A service worker emellett alap
offline-cache-elést is ad: amit egyszer már megnyitottál online, az
internet nélkül is betöltődik (a mentés/felhős szinkron természetesen csak
online működik). Ez fejlesztői módban (`next dev`) szándékosan ki van
kapcsolva, hogy ne zavarja a hot-reloadot — csak éles (`next build` +
`next start`, illetve a Vercelre telepített verzió) build-ben aktiválódik.

## Gyors keresés / parancspaletta (`Ctrl+K`)

A sidebar tetején lévő "Gyors keresés…" mezőre kattintva, vagy bárhonnan a
`Ctrl+K` (Mac-en `Cmd+K`) billentyűkombinációval megnyitható egy kereső
ablak, amiben gépelés közben egyszerre látod:

- a fő **nézeteket** (Kezdőlap, Naptár, Kreditindex, Összes jegyzetem),
- a **tárgyaidat** (név vagy tárgykód alapján kereshetők),
- a **jegyzeteidet** (cím és tartalom alapján is — üres keresésnél a
  legutóbb módosítottak jelennek meg elsőként).

A nyílbillentyűkkel navigálhatsz a találatok között, `Enter`-rel ugorhatsz a
kiválasztottra, `Esc`-kel zárhatod be. Ha egy tárgy egy nem az aktív
félévedben van, a kiválasztás automatikusan azt a félévet is aktívvá teszi,
hogy a sidebar és a tárgy-nézet konzisztens maradjon.

## Jegyzet-mellékletek

A jegyzetszerkesztő eszköztárában a kép ikonra kattintva (vagy a
`Ctrl+K`-hoz hasonlóan a fájlválasztóval) képet csatolhatsz egy jegyzethez —
pl. egy lefotózott táblaképet vagy ábrát. A csatolt képek kis
bélyegképként jelennek meg a jegyzet alján, és teljes méretben egy új fülön
nyithatók meg.

**Fontos korlát:** mivel az egész alkalmazásállapot (az összes féléved,
tárgyad és jegyzeted) egyetlen Firestore-dokumentumban szinkronizálódik a
felhővel, aminek kb. 1 MB-os mérethatára van, a képeket feltöltéskor az app
automatikusan tömöríti (kb. 1280 px-es max. méretre skálázva, JPEG
minőségcsökkentéssel), és jegyzetenként legfeljebb 6 kép csatolható. Ha egy
kép tömörítve is túl nagy maradna, az app hibaüzenettel jelzi — ilyenkor
érdemes egy kisebb vagy egyszerűbb képet választani. Ez a korlát nem
vonatkozik a jegyzet szöveges tartalmára, csak a képmellékletekre.

## Jegyzet-verziótörténet

A jegyzetszerkesztő fejlécében (egy már mentett jegyzetnél) egy óra ikon
nyitja meg az **"Előzmények"** ablakot, ahol a jegyzet korábbi cím+tartalom
állapotai listázva vannak — időbélyeggel, kibontható teljes szöveggel, és
egy **"Visszaállítás"** gombbal. A visszaállítás nem visszafordíthatatlan:
a visszaállítás előtti állapot is automatikusan bekerül egy új
pillanatképként, tehát mindig van visszaút.

**Mikor készül új pillanatkép:** a szerkesztő 700ms-es debounce-szal
automatikusan ment gépelés közben — enélkül a hűtési idő nélkül minden
apró automentés külön verziót hozna létre, és az előzmények lista
gyakorlatilag egy gépelés közbeni undo-stack lenne, nem egy áttekinthető
napló. Ezért az app legfeljebb **5 percenként** vesz fel egy új
pillanatképet (a visszaállítás művelete ez alól kivétel — az mindig
elmenti az aktuális állapotot, a hűtési időtől függetlenül).

**Korlátok:** jegyzetenként legfeljebb **15 korábbi verzió** tárolódik — ha
betelik, a legrégebbi törlődik. Csak a **cím és a szöveges tartalom**
verziózott, a képmellékletek nem (mert azok mérete a Firestore ~1 MB-os
dokumentumkorlátját gyorsan szétfeszítené, ha minden verzióban újra
eltárolódnának) — egy régebbi verzió visszaállítása tehát a jegyzet
szövegét állítja vissza, a jelenleg csatolt képeket nem érinti.

## Félév-összefoglaló nyomtatás / PDF export

A Kreditindex nézeten minden félév fejlécében egy nyomtató ikon nyit meg egy
áttekintő, nyomtatható összefoglalót az adott félévről: kredit-súlyozott
átlag, összes és megszerzett kredit, majd tárgyanként a kredit, a becsült
jegy és a hiányzás egy táblázatban. Az összefoglaló egy új ablakban nyílik
meg, és automatikusan elindítja a böngésző nyomtatási párbeszédét — itt
választhatod ki, hogy ténylegesen nyomtatod-e, vagy "Mentés PDF-ként"
céllal fájlba mented. Ha a böngésződ letiltja a felugró ablakot, egy toast
jelzi, hogy engedélyezned kell.

## .ics naptár-import

A [.ics naptár-export](#ics-naptár-export) visszafelé iránya: a Naptár
nézeten a **"Naptár importálása (.ics)"** gombbal egy külső (pl. egyetemi
vagy más hallgatói) naptár `.ics` fájlját is beimportálhatod. A benne lévő
eseményeket az app hozzáadja a meglévő órarendedhez (nem cseréli le, mint a
Neptun-import), és — a névegyezés alapján — automatikusan összekapcsolja a
tárgyaiddal, ahol lehet. Ugyanazt a fájlt véletlenül kétszer importálva a
már meglévő (azonos című, azonos időpontú) eseményeket az app kihagyja, nem
duplikálja.

**Korlátok:** az időzóna-jelöléseket (TZID) nem értelmezi az importáló —
az időpontokat a böngésződ saját (helyi) időzónájában kezeli, ami magyar
naptáraknál a gyakorlatban helyes eredményt ad; ismétlődő eseményeket
(`RRULE`) nem bontja ki, csak az egyszeri előfordulást importálja.

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

## Email-emlékeztetők beállítása (Resend + Vercel Cron)

Az [Emlékeztetők közelgő határidőkre](#emlékeztetők-közelgő-határidőkre)
szakaszban leírt harang-gomb **böngésző**-értesítést küld, tehát csak akkor
jelez, ha az app tényleg nyitva van (vagy fókuszba kerül). Az
**email-emlékeztető** ettől független, és egy szerver oldali, naponta
egyszer lefutó ütemezett feladat küldi — akkor is megérkezik, ha a laptopod
csukva van. Ehhez már túl kell lenned az [Élesítés (deploy)
Vercelre](#élesítés-deploy-vercelre--hogy-tényleg-bárhonnan-elérd) lépésen,
mert az ütemezés (Vercel Cron) csak az éles Vercel-deployon fut, `npm run
dev` alatt nem.

**Ez a rész teljesen opcionális** — nélküle minden más funkció (beleértve a
böngésző-emlékeztetőt is) ugyanúgy működik.

1. **Resend fiók + API kulcs.** Regisztrálj a [resend.com](https://resend.com)
   oldalon (ingyenes csomag is elég), majd **API Keys** menüpontban hozz
   létre egy kulcsot. Ezt írd be a Vercel projekt env-változói közé
   `RESEND_API_KEY` néven.
   - **Fontos korlát:** amíg nem igazolsz saját domaint a Resend-ben, csak a
     saját Resend-fiókodhoz tartozó email címre tudsz vele küldeni (ez
     teszteléshez pont elég). Éles, "bárhonnan bejövő" használathoz add
     hozzá és igazold a saját domained a Resend **Domains** menüjében, és
     onnantól a `RESEND_FROM_EMAIL` lehet pl. `emlekezteto@sajatdomain.hu`.
     Domain nélkül a Resend saját tesztcíme (`onboarding@resend.dev`) is
     használható `RESEND_FROM_EMAIL`-nek, de csak a saját fiókod címére
     küld ki vele.
2. **Firebase szolgáltatásfiók (service account).** A [Firebase
   Console](https://console.firebase.google.com)-ban: **Project settings**
   (fogaskerék ikon) → **Service accounts** fül → **Generate new private
   key**. Ez letölt egy JSON fájlt — ebből három mezőt kell átmásolnod a
   Vercel env-változói közé:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (a teljes értéket, a
     `-----BEGIN PRIVATE KEY-----`/`-----END...-----` sorokkal és a benne
     lévő `\n`-ekkel együtt, ahogy a JSON-ban áll)

   **Ezt a fájlt soha ne commitold a git repóba és ne oszd meg senkivel** —
   teljes hozzáférést ad a Firestore adatbázisodhoz.
3. **CRON_SECRET.** Találj ki egy tetszőleges hosszú, véletlenszerű stringet
   (pl. egy jelszógenerátorral), és add hozzá a Vercel env-változókhoz
   `CRON_SECRET` néven. A Vercel ezt automatikusan `Authorization: Bearer
   <érték>` fejlécként küldi, amikor az ütemezett feladatot elindítja — ez
   védi az endpointot attól, hogy bárki más kívülről meghívhassa.
4. **Vercel Dashboard → Settings → Environment Variables** — mind az öt fenti
   változót (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FIREBASE_ADMIN_PROJECT_ID`,
   `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`,
   `CRON_SECRET`) add hozzá, majd deployolj újra (`vercel --prod`), hogy
   érvénybe lépjenek.
5. A `vercel.json` fájl (már a repóban van) mondja meg a Vercel-nek, hogy
   naponta 06:00 UTC-kor (nyáron kb. 8:00, télen kb. 7:00 magyar idő) hívja
   meg a `/api/cron/email-reminders` endpointot — ezt a Vercel automatikusan
   felismeri deploy-kor, nincs hozzá külön teendő. A Vercel **Hobby**
   (ingyenes) csomag naponta egy futtatást enged ütemezett feladatonként,
   ami pont elég ehhez.
6. **Bekapcsolás az appban:** az oldalsáv alján, a harang gomb mellett lévő
   boríték ikonra kattintva bekapcsolhatod az email-emlékeztetőt, és
   beállíthatod, hány nappal a határidő előtt kapj emailt (alapértelmezés: 3
   nap). A levelek a bejelentkezéshez használt email címre érkeznek, és csak
   a még nem teljesítve jelölt **ZH/vizsga** típusú követelményekről szólnak
   (beadandó/egyéb típusra nem küld).

**Tesztelés:** az endpoint kézzel is meghívható, hogy ne kelljen egy teljes
napot várni:

```bash
curl -H "Authorization: Bearer <a te CRON_SECRET-ed>" \
  https://<a-te-domained>.vercel.app/api/cron/email-reminders
```

A válasz JSON-ban mutatja, hány felhasználónál van bekapcsolva az
emlékeztető, és hány emailt küldött ki ténylegesen — ha `emailsSent: 0`, az
azért lehet, mert épp senkinek sincs a beállított napon belüli, még
teljesítetlen ZH/vizsga határideje, nem feltétlenül hiba.

**Hogyan kerüli el a duplikált emaileket:** minden elküldött emlékeztetőt
(követelmény-azonosító + határidő párosítva) egy külön, csak a szerver
által elérhető Firestore kollekcióban (`emailReminderState`) jegyez fel a
rendszer — ugyanarra a határidőre nem küld kétszer, még akkor sem, ha a
napi feladat többször lefut vagy egy nap kimarad.

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
│   ├── globals.css                   # Tailwind + shadcn CSS-változók (light/dark) + typography plugin
│   └── api/cron/email-reminders/
│       └── route.ts                  # Napi email-emlékeztető Route Handler (Vercel Cron hívja)
├── components/
│   ├── ui/                           # shadcn/ui primitívek (button, card, tabs, dialog, alert-dialog, ...)
│   ├── auth/
│   │   └── AuthScreen.tsx            # Bejelentkezés/regisztráció + "Firebase nincs beállítva" képernyő
│   ├── layout/
│   │   ├── AppShell.tsx              # Auth-kapu + nézet-állapotgép (Nezet típus) + fő elrendezés
│   │   ├── Sidebar.tsx               # Félévek/tárgyak fa nézet, téma váltó, export/import, sync jelző, kijelentkezés
│   │   ├── HomeOverview.tsx          # Kezdőlap dashboard
│   │   ├── CommandPalette.tsx        # Gyors keresés / parancspaletta (Ctrl+K)
│   │   ├── ReminderBell.tsx          # Böngésző-emlékeztető harang
│   │   ├── EmailReminderButton.tsx   # Email-emlékeztető be/ki + gyakoriság beállítás
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
│       ├── NoteVersionHistoryDialog.tsx # Verziótörténet lista + visszaállítás
│       ├── GlobalNotes.tsx           # Összes jegyzetem — kereső + címke-szűrő
│       └── MarkdownContent.tsx       # Renderelt Markdown megjelenítő komponens
├── lib/
│   ├── store.ts                      # Zustand store — CRUD, export/import
│   ├── firebase.ts                   # Firebase app/auth/Firestore inicializálás env-változókból
│   ├── auth.ts                       # Bejelentkezési állapot (useAuthStatus) + auth műveletek
│   ├── cloud-sync.ts                 # Kétirányú Firestore szinkron (useCloudSync, useSyncStatus)
│   ├── markdown.ts                   # renderMarkdown() — marked wrapper
│   ├── subject-icons.ts              # Választható tárgy-ikonok
│   ├── note-attachments.ts           # Képmelléklet-tömörítés (canvas), méretkorlátok
│   ├── note-templates.ts             # Jegyzet-sablonok (Markdown vázak)
│   ├── ics-export.ts                 # .ics naptár-export (RFC5545)
│   ├── ics-import.ts                 # .ics naptár-import (RFC5545 parse)
│   ├── semester-summary.ts           # Félév-összefoglaló nyomtatás / PDF export
│   ├── reminders.ts                  # Böngésző-emlékeztető (Notification API)
│   ├── email-reminders.ts            # Email-emlékeztető logika (esedékesség-számítás, HTML sablon)
│   ├── firebase-admin.ts             # Firebase Admin SDK init — SZERVER OLDALI, csak a cron route-ból
│   └── utils.ts                      # cn(), formatDateHu(), parseTags()...
├── types/
│   └── index.ts                      # Semester, Subject, Note, Requirement
├── firestore.rules                   # Firestore biztonsági szabályok (csak saját uid alatt)
├── vercel.json                       # Vercel Cron ütemezés (napi email-emlékeztető)
├── .env.local.example                # Firebase kulcsok + email-emlékeztető kulcsok sablonja
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
