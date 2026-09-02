"use client";

import { useState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAuthStatus } from "@/lib/auth";
import { useAppStore } from "@/lib/store";

/**
 * Email-emlékeztetők beállítása: ezt egy szerver oldali ütemezett feladat
 * (Vercel Cron) küldi naponta egyszer, nem a böngésző — ezért működik akkor
 * is, ha az app nincs megnyitva. A beállítás (be/ki + hány nappal előtte)
 * a felhő-szinkronnal együtt utazik, a tényleges levélküldés viszont a
 * README-ben leírt Resend + Firebase Admin beállítástól függ, amit az
 * alkalmazás üzemeltetőjének (jellemzően saját magának) kell egyszer
 * elvégeznie a Vercel projektben.
 */
export function EmailReminderButton() {
  const { user } = useAuthStatus();
  const emailReminders = useAppStore((s) => s.emailReminders);
  const setEmailReminders = useAppStore((s) => s.setEmailReminders);

  const [open, setOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const [enabled, setEnabled] = useState(emailReminders.enabled);
  const [napokElotte, setNapokElotte] = useState(String(emailReminders.napokElotte));

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEnabled(emailReminders.enabled);
      setNapokElotte(String(emailReminders.napokElotte));
    }
  }

  function handleSave() {
    const parsedNapok = Math.min(30, Math.max(1, Math.round(Number(napokElotte)) || 3));
    setEmailReminders({ enabled, napokElotte: parsedNapok });
    toast.success(
      enabled
        ? `Email-emlékeztetők bekapcsolva — ${parsedNapok} nappal a ZH/vizsga határideje előtt kapsz levelet.`
        : "Email-emlékeztetők kikapcsolva."
    );
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
        aria-label="Email-emlékeztetők beállítása"
        title="Email-emlékeztetők beállítása"
      >
        {emailReminders.enabled ? <MailCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email-emlékeztetők</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A közelgő, még nem teljesített ZH-król és vizsgákról kapsz emailt —
              a naptárban/tárgyaknál rögzített határidők alapján, naponta
              legfeljebb egyszer küldve, akkor is, ha az app nincs megnyitva.
            </p>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-md border p-3">
              <Checkbox
                checked={enabled}
                onCheckedChange={(v) => setEnabled(v === true)}
              />
              <span className="text-sm">Email-emlékeztetők bekapcsolása</span>
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="email-reminder-napok">Hány nappal a határidő előtt</Label>
              <Input
                id="email-reminder-napok"
                type="number"
                min={1}
                max={30}
                value={napokElotte}
                onChange={(e) => setNapokElotte(e.target.value)}
                disabled={!enabled}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              A levelek a fiókodhoz tartozó{" "}
              <span className="font-medium text-foreground">{user?.email ?? "email címre"}</span>{" "}
              érkeznek.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSave}>Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
