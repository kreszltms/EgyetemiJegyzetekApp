import { REQUIREMENT_TYPE_LABELS, type Requirement, type Subject } from "@/types";

// ============================================================================
// UNINOTES — Email-emlékeztető logika (szerver oldalon fut, de
// tiszta függvényekből áll, hogy szükség esetén külön is tesztelhető legyen).
// Használja: app/api/cron/email-reminders/route.ts
// ============================================================================

/** Csak ezekre a követelménytípusokra küldünk email-emlékeztetőt. */
const REMINDER_TYPES: Requirement["tipus"][] = ["zh", "vizsga"];

export interface DueReminderItem {
  /** Dedup kulcs: ugyanarra a követelményre/határidőre csak egyszer küldünk. */
  key: string;
  subjectNev: string;
  requirement: Requirement;
  /** 0 = ma esedékes, 1 = holnap, stb. */
  napokMulva: number;
}

/** "YYYY-MM-DD" → UTC epoch ms, dátum-only összehasonlításhoz (időzóna-semleges). */
function parseDateOnly(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

/**
 * Végigmegy egy felhasználó tárgyain, és összegyűjti azokat a még nem
 * teljesített ZH/vizsga követelményeket, amiknek a határideje a mai naptól
 * `napokElotte` napon belülre esik (a mait is beleértve), és amikre még nem
 * küldtünk emailt (`alreadySentKeys`).
 */
export function computeDueReminders(
  subjects: Subject[],
  napokElotte: number,
  todayIso: string,
  alreadySentKeys: string[]
): { items: DueReminderItem[]; newKeys: string[] } {
  const todayMs = parseDateOnly(todayIso);
  const sentSet = new Set(alreadySentKeys);
  const items: DueReminderItem[] = [];
  const newKeys: string[] = [];

  for (const subject of subjects) {
    for (const req of subject.kovetelmenyek ?? []) {
      if (req.teljesitve) continue;
      if (!REMINDER_TYPES.includes(req.tipus)) continue;
      if (!req.hatarido) continue;

      const key = `${req.id}:${req.hatarido}`;
      if (sentSet.has(key)) continue;

      const dueMs = parseDateOnly(req.hatarido);
      const napokMulva = Math.round((dueMs - todayMs) / 86_400_000);
      if (napokMulva < 0 || napokMulva > napokElotte) continue;

      items.push({ key, subjectNev: subject.nev, requirement: req, napokMulva });
      newKeys.push(key);
    }
  }

  // Legközelebbi határidő elöl.
  items.sort((a, b) => a.napokMulva - b.napokMulva);

  return { items, newKeys };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Egy összefoglaló email HTML törzse a mai napon esedékes emlékeztetőkről. */
export function buildReminderEmailHtml(items: DueReminderItem[]): string {
  const rows = items
    .map((item) => {
      const mikor =
        item.napokMulva === 0
          ? "ma esedékes"
          : item.napokMulva === 1
            ? "holnap esedékes"
            : `${item.napokMulva} nap múlva esedékes`;
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:600;color:#111827;">${escapeHtml(item.requirement.nev)}</div>
            <div style="font-size:13px;color:#6b7280;">${escapeHtml(item.subjectNev)} · ${REQUIREMENT_TYPE_LABELS[item.requirement.tipus]}</div>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#374151;white-space:nowrap;">
            ${escapeHtml(item.requirement.hatarido ?? "")}<br/>
            <span style="color:#9ca3af;">${mikor}</span>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#111827;margin-bottom:4px;">Közelgő határidők</h2>
      <p style="color:#4b5563;font-size:14px;">
        Ezekre a zárthelyikre/vizsgákra még nincs jelölve teljesítve az
        UniNotes appban:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${rows}
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        Ezt az emailt azért kaptad, mert bekapcsoltad az email-emlékeztetőket
        az UniNotes alkalmazásban. Az oldalsávban bármikor
        kikapcsolhatod.
      </p>
    </div>`;
}

/** Az email tárgysora — egy vagy több tétel esetén eltérő megfogalmazással. */
export function buildReminderEmailSubject(items: DueReminderItem[]): string {
  if (items.length === 1) {
    return `Közelgő határidő: ${items[0].requirement.nev}`;
  }
  return `${items.length} közelgő határidő az UniNotesben`;
}
