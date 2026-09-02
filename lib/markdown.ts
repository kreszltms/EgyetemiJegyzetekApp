import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * Egyszerű Markdown → HTML konvertálás a jegyzet-nézetekhez.
 *
 * Nincs külön sanitizálás: minden jegyzet a felhasználó saját böngészőjében,
 * saját maga által beírt tartalomból származik (nincs szerver, nincs
 * megosztás más felhasználóval), így a self-XSS kockázat elhanyagolható.
 * Ha később szerveroldali szinkronizálás vagy megosztás kerülne az
 * alkalmazásba, itt kellene beiktatni pl. DOMPurify-t.
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  return marked.parse(markdown, { async: false }) as string;
}
