import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: true });

/**
 * Egyszerű Markdown → HTML konvertálás a jegyzet-nézetekhez.
 *
 * FONTOS — miért kell sanitizálni: a Markdown formátum (és a `marked`
 * könyvtár) szándékosan átengedi a nyers HTML-t is a bemenetből (pl. egy
 * `<img src=x onerror="...">` sort). Ez NEM csak "self-XSS", mert a
 * jegyzetek felhő-szinkronban (lib/cloud-sync.ts) több eszköz/böngésző-
 * munkamenet között utaznak, és a "Biztonsági mentés" JSON importja (lib/
 * store.ts importJsonBackup) is közvetlenül ide táplálhat máshonnan
 * (pl. egy megosztott .json mentésfájlból) származó tartalmat — egy ott
 * elrejtett payload a jegyzet MEGNYITÁSAKOR futna le, ami tárolt XSS-nek
 * (stored XSS) számít. Ezért a marked kimenetét mindig DOMPurify-jal
 * tisztítjuk, mielőtt a UI `dangerouslySetInnerHTML`-lel beilleszti.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    // <script>, esemény-attribútumok (onerror, onclick stb.) és a
    // "javascript:"/"data:text/html" séma alapból tiltott a DOMPurify
    // alapértelmezésével — itt csak explicitté tesszük, hogy a mellékletek
    // (data:image/... base64 képek) linkjei/img src-jei ne törjenek el.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/|#|\/(?!\/))/i,
  });
}
