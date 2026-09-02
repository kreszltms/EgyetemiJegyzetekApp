import { generateId } from "@/lib/utils";
import type { NoteAttachment } from "@/types";

// ============================================================================
// EGYETEMI JEGYZETEK — Jegyzet-mellékletek (kép csatolása)
//
// Csak KÉP mellékletet támogatunk (nem tetszőleges fájlt): mivel az egész
// alkalmazásállapot egyetlen Firestore dokumentumban tárolódik (lásd
// lib/cloud-sync.ts), aminek kb. 1 MB-os mérethatára van, tetszőleges
// méretű fájlok data URL-ként tárolása könnyen elronthatná a felhő-
// szinkronizációt. Ezért feltöltéskor kliensoldalon (canvas-szal)
// tömörítjük a képet, és méretkorlátot is szabunk.
// ============================================================================

const MAX_DIMENSION = 1280;
/** Ha ennél nagyobb lenne a tömörített kép, egyre alacsonyabb minőséggel
 * próbálkozunk újra, mielőtt feladnánk. */
const MAX_DATA_URL_BYTES = 400_000;
const QUALITY_STEPS = [0.75, 0.55, 0.4, 0.28];
export const MAX_ATTACHMENTS_PER_NOTE = 6;

export type ProcessImageResult =
  | { success: true; attachment: NoteAttachment }
  | { success: false; error: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = dataUrl;
  });
}

function scaledSize(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = width > height ? maxDim / width : maxDim / height;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Egy File objektumból (pl. <input type="file"> vagy vágólap-beillesztés)
 * tömörített, méretkorlátozott képmellékletet készít. Iteratívan csökkenti
 * a JPEG minőséget, amíg a data URL a méretkorlát alá nem kerül.
 */
export async function processImageFile(file: File): Promise<ProcessImageResult> {
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Csak kép csatolható (JPEG, PNG, WEBP stb.)." };
  }

  let sourceDataUrl: string;
  try {
    sourceDataUrl = await readFileAsDataUrl(file);
  } catch {
    return { success: false, error: "Nem sikerült beolvasni a fájlt." };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(sourceDataUrl);
  } catch {
    return { success: false, error: "A fájl nem értelmezhető képként." };
  }

  const { width, height } = scaledSize(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { success: false, error: "A böngésző nem támogatja a kép feldolgozását." };
  }
  ctx.drawImage(img, 0, 0, width, height);

  let compressed = "";
  for (const quality of QUALITY_STEPS) {
    compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length <= MAX_DATA_URL_BYTES) break;
  }

  if (compressed.length > MAX_DATA_URL_BYTES) {
    return {
      success: false,
      error: "A kép tömörítve is túl nagy — próbálj egy kisebb vagy egyszerűbb képet.",
    };
  }

  return {
    success: true,
    attachment: {
      id: generateId(),
      dataUrl: compressed,
      nev: file.name,
      meret: compressed.length,
    },
  };
}

/** Emberi olvasásra formázott fájlméret, pl. "128 KB". */
export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
