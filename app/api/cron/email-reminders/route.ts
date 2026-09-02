import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  buildReminderEmailHtml,
  buildReminderEmailSubject,
  computeDueReminders,
} from "@/lib/email-reminders";
import type { AppData, Subject } from "@/types";

// ============================================================================
// UNINOTES — Napi email-emlékeztető ütemezett feladat (Vercel Cron)
//
// A vercel.json "crons" bejegyzése hívja meg ezt naponta egyszer. Vercel a
// hívásnál automatikusan `Authorization: Bearer <CRON_SECRET>` fejlécet küld,
// HA be van állítva a CRON_SECRET env-változó a projektben — ezt ellenőrizzük
// lent, hogy más ne tudja kívülről meghívni ezt az endpointot.
//
// Minden bejelentkezett felhasználó `userData/{uid}` Firestore dokumentumát
// végignézzük (Firebase Admin SDK-val, ami megkerüli a kliens biztonsági
// szabályokat), és akiknél be van kapcsolva az `emailReminders.enabled`,
// azoknál összegyűjtjük a közelgő, még nem teljesített ZH/vizsga
// követelményeket, és egy összefoglaló emailt küldünk a Resend API-n
// keresztül.
//
// FONTOS: a már elküldött emlékeztetőket egy KÜLÖN Firestore kollekcióban
// (`emailReminderState/{uid}`) tartjuk nyilván, NEM a userData dokumentumban
// — mert a kliens (lib/cloud-sync.ts) minden mentéskor a TELJES
// userData/{uid} dokumentumot felülírja (setDoc, merge nélkül), ami törölné
// az admin SDK által ide írt bármilyen mezőt.
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "A CRON_SECRET env-változó nincs beállítva a szerveren." },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !fromEmail) {
    return NextResponse.json(
      { error: "A RESEND_API_KEY / RESEND_FROM_EMAIL env-változó nincs beállítva." },
      { status: 500 }
    );
  }

  let db: ReturnType<typeof getAdminDb>;
  let auth: ReturnType<typeof getAdminAuth>;
  try {
    db = getAdminDb();
    auth = getAdminAuth();
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const usersSnap = await db.collection("userData").get();

  let usersWithRemindersOn = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  for (const docSnap of usersSnap.docs) {
    const uid = docSnap.id;
    const data = docSnap.data() as Partial<AppData> | undefined;
    const settings = data?.emailReminders;
    if (!settings?.enabled) continue;
    usersWithRemindersOn += 1;

    const subjects = Array.isArray(data?.subjects) ? (data!.subjects as Subject[]) : [];

    try {
      const stateRef = db.collection("emailReminderState").doc(uid);
      const stateSnap = await stateRef.get();
      const stateData = stateSnap.data() as { sentKeys?: unknown } | undefined;
      const sentKeys: string[] = Array.isArray(stateData?.sentKeys)
        ? (stateData!.sentKeys as string[])
        : [];

      const { items, newKeys } = computeDueReminders(
        subjects,
        settings.napokElotte || 3,
        todayIso,
        sentKeys
      );
      if (items.length === 0) continue;

      const userRecord = await auth.getUser(uid);
      const to = userRecord.email;
      if (!to) {
        errors.push(`${uid}: nincs email cím a Firebase Auth fiókhoz.`);
        continue;
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject: buildReminderEmailSubject(items),
          html: buildReminderEmailHtml(items),
        }),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        errors.push(`${uid}: Resend hiba (${res.status}) ${bodyText.slice(0, 200)}`);
        continue;
      }

      emailsSent += 1;
      // Csak a legutóbbi 500 kulcsot tartjuk meg, hogy a dokumentum ne
      // nőjön korlátlanul egy sosem-teljesített, sosem-törölt követelmény
      // miatt sem (bár a hatarido-t tartalmazó kulcs úgyis lecserélődne,
      // ha a felhasználó módosítja a határidőt).
      const updatedKeys = [...sentKeys, ...newKeys].slice(-500);
      await stateRef.set({ sentKeys: updatedKeys, updatedAt: new Date().toISOString() });
    } catch (err) {
      errors.push(`${uid}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    todayIso,
    usersWithRemindersOn,
    emailsSent,
    errors,
  });
}
