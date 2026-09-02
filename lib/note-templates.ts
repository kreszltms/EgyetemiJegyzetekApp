// ============================================================================
// EGYETEMI JEGYZETEK — Jegyzet-sablonok
// Előre megírt Markdown-vázak, amiket egy még üres jegyzethez lehet
// választani, hogy ne üres lappal kelljen indulni.
// ============================================================================

export interface NoteTemplate {
  id: string;
  label: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "eloadas",
    label: "Előadás",
    content: `## Téma

## Kulcsfogalmak
-

## Összefoglalás

## Nyitott kérdéseim
- [ ] `,
  },
  {
    id: "vizsga",
    label: "Vizsgafelkészülés",
    content: `## Vizsgakérdés

## Válasz vázlata
1.
2.
3.

## Kapcsolódó fogalmak
- `,
  },
  {
    id: "gyakorlat",
    label: "Gyakorlat / labor",
    content: `## Feladat

## Megoldás lépései
1.

## Eredmény / tanulság
`,
  },
];
