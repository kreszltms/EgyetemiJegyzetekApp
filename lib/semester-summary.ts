import { attendanceStatus } from "@/lib/utils";
import { formatGrade } from "@/lib/pontozas";
import type { KreditIndexResult } from "@/lib/kreditindex";
import type { Semester } from "@/types";

// ============================================================================
// UNINOTES — Félév-összefoglaló nyomtatás / PDF export
//
// Nincs PDF-generáló függőség (jsPDF stb.) — ehelyett egy önálló, letisztult
// HTML dokumentumot nyitunk egy új ablakban, és a böngésző natív nyomtatási
// párbeszédét hívjuk meg (window.print()), amiben a felhasználó "Mentés
// PDF-ként" céllal is elmentheti. Ez ugyanaz a minta, amit a legtöbb webes
// alkalmazás használ nyomtatható jelentésekhez — nincs szükség kliensoldali
// PDF-rendereléshez extra csomagra.
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSemesterSummaryHtml(
  semester: Semester,
  result: KreditIndexResult
): string {
  const generatedAt = new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const rows = result.items
    .map(({ subject, kredit, hasKredit, grade, included }) => {
      const attendance = attendanceStatus(
        subject.hianyzas.jelenlegiHianyzas,
        subject.hianyzas.maxHianyzas
      );
      const gradeCell =
        included && grade !== null
          ? escapeHtml(formatGrade(grade))
          : `<span class="muted">${!hasKredit ? "nincs kredit" : "nincs pont"}</span>`;
      return `
        <tr>
          <td>${escapeHtml(subject.nev)}</td>
          <td class="mono">${escapeHtml(subject.kod)}</td>
          <td class="num">${hasKredit ? kredit : "—"}</td>
          <td class="num">${gradeCell}</td>
          <td class="num ${attendance.variant === "danger" ? "danger" : ""}">
            ${subject.hianyzas.jelenlegiHianyzas} / ${subject.hianyzas.maxHianyzas}
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8" />
<title>Félév-összefoglaló — ${escapeHtml(semester.nev)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #18181b;
    background: #fff;
    margin: 0;
    padding: 40px 48px;
  }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .subtitle { color: #71717a; font-size: 13px; margin: 0 0 28px; }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .stat {
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    padding: 14px 16px;
  }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #71717a; }
  .stat .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e4e7; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #71717a; font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #52525b; }
  td.danger { color: #dc2626; font-weight: 600; }
  .muted { color: #a1a1aa; font-style: italic; }
  footer { margin-top: 32px; font-size: 11px; color: #a1a1aa; }
  @media print {
    body { padding: 16mm; }
    .stat { break-inside: avoid; }
    table { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>Félév-összefoglaló — ${escapeHtml(semester.nev)}</h1>
  <p class="subtitle">Generálva: ${escapeHtml(generatedAt)} · UniNotes</p>

  <div class="stats">
    <div class="stat">
      <div class="label">Kreditindex</div>
      <div class="value">${result.average !== null ? result.average.toFixed(2) : "—"}</div>
    </div>
    <div class="stat">
      <div class="label">Összes kredit</div>
      <div class="value">${result.totalKredit}</div>
    </div>
    <div class="stat">
      <div class="label">Megszerzett kredit</div>
      <div class="value">${result.earnedKredit}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Tárgy</th>
        <th>Kód</th>
        <th class="num">Kredit</th>
        <th class="num">Jegy</th>
        <th class="num">Hiányzás</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="5" class="muted">Ebben a félévben még nincs felvett tárgy.</td></tr>`}
    </tbody>
  </table>

  <footer>UniNotes — automatikusan generált összefoglaló, nem hivatalos leckekönyvi kivonat.</footer>
</body>
</html>`;
}

/**
 * Megnyitja a nyomtatható összefoglalót egy új ablakban, és elindítja a
 * böngésző nyomtatási párbeszédét. Ha a böngésző letiltja a felugró
 * ablakot, `false`-t ad vissza, hogy a hívó fél toast-tal jelezhesse.
 */
export function openSemesterSummaryPrint(
  semester: Semester,
  result: KreditIndexResult
): boolean {
  const html = buildSemesterSummaryHtml(semester, result);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.print();
    } catch {
      // no-op — ha az ablakot időközben bezárták
    }
  };
  win.onload = triggerPrint;
  // Néhány böngészőben az onload nem tüzel, ha a dokumentum már készen áll
  // mire ideérünk — biztonsági hálóként egy rövid késleltetéssel is
  // megpróbáljuk, de a `printed` flag miatt csak egyszer sül el ténylegesen.
  setTimeout(triggerPrint, 300);
  return true;
}
