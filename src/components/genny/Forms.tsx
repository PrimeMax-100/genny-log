import { useEffect, useState } from "react";
import { Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGenny, formatMoney, useElapsed, formatClock } from "@/lib/genny-store";
import { REASONS, type FuelEntry, type Reason, type RuntimeEntry } from "@/lib/genny-storage";
import { cn } from "@/lib/utils";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function FormShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X /></Button>
      </div>
      {children}
    </div>
  );
}

export type FuelDraft = { litres: number; pricePerLitre: number; date: string; note: string | null };
export type RuntimeDraft = { hours: number; reason: Reason; date: string };

export function FuelForm({ entry, draft, onDone }: { entry?: FuelEntry | undefined; draft?: FuelDraft | undefined; onDone: () => void }) {
  const { saveFuel, deleteFuel, data, fuel } = useGenny();
  const lastPrice = fuel[0]?.pricePerLitre;
  const [litres, setLitres] = useState(entry ? String(entry.litres) : draft ? String(draft.litres) : "");
  const [price, setPrice] = useState(entry ? String(entry.pricePerLitre) : draft ? String(draft.pricePerLitre) : lastPrice ? String(lastPrice) : "");
  const [date, setDate] = useState(toLocalInput(entry?.date ?? draft?.date ?? new Date().toISOString()));
  const [note, setNote] = useState(entry?.note ?? draft?.note ?? "");
  const l = parseFloat(litres), p = parseFloat(price);
  const valid = l > 0 && l < 100000 && p > 0 && p < 10000000;
  const total = valid ? l * p : 0;

  return (
    <FormShell title={entry ? "Edit fuel" : draft ? "Check & save fuel" : "Log fuel"} onClose={onDone}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="litres">Litres</Label>
          <Input id="litres" inputMode="decimal" autoFocus className="h-14 font-num text-2xl" value={litres}
            onChange={(e) => setLitres(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Price / litre</Label>
          <Input id="price" inputMode="decimal" className="h-14 font-num text-2xl" value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Total cost</div>
        <div className="font-num text-4xl font-bold text-primary">{formatMoney(total, data.settings.currency, 2)}</div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fdate">Date</Label>
        <Input id="fdate" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Filling station on Allen Ave" />
      </div>
      <div className="flex gap-3">
        {entry && (
          <Button variant="destructive" className="h-14" onClick={() => { deleteFuel(entry.id); onDone(); }}>Delete</Button>
        )}
        <Button variant="secondary" className="h-14 flex-1" onClick={onDone}>Cancel</Button>
        <Button className="h-14 flex-1 text-lg" disabled={!valid} onClick={() => {
          saveFuel({ id: entry?.id, litres: l, pricePerLitre: p, date: new Date(date).toISOString(), note: note.trim() || undefined });
          onDone();
        }}>Save</Button>
      </div>
    </FormShell>
  );
}

function ReasonPicker({ value, onChange }: { value: Reason | null; onChange: (r: Reason) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Reason</Label>
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className={cn("min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              value === r ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RuntimeForm({ entry, draft, onDone }: { entry?: RuntimeEntry | undefined; draft?: RuntimeDraft | undefined; onDone: () => void }) {
  const { data, startRun, stopRun, cancelRun, saveRuntime, deleteRuntime } = useGenny();
  const running = data.activeRun;
  const [mode, setMode] = useState<"live" | "manual">(entry || draft ? "manual" : "live");
  const [reason, setReason] = useState<Reason | null>(entry?.reason ?? draft?.reason ?? null);
  const [hours, setHours] = useState(entry ? String(entry.hours) : draft ? String(draft.hours) : "");
  const [date, setDate] = useState(toLocalInput(entry?.date ?? draft?.date ?? new Date().toISOString()));
  const elapsed = useElapsed(running?.startTime);
  useEffect(() => { if (running) setMode("live"); }, [running]);
  const h = parseFloat(hours);

  return (
    <FormShell title={entry ? "Edit runtime" : draft ? "Check & save runtime" : "Log runtime"} onClose={onDone}>
      {!entry && (
        <Tabs value={mode} onValueChange={(v) => setMode(v as "live" | "manual")}>
          <TabsList className="grid h-12 w-full grid-cols-2">
            <TabsTrigger value="live" className="h-10">Live timer</TabsTrigger>
            <TabsTrigger value="manual" className="h-10" disabled={!!running}>Enter hours</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {mode === "live" && !entry ? (
        <div className="space-y-5">
          <div className={cn("rounded-2xl border p-6 text-center", running && "border-primary")}>
            <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              {running && <span className="genny-pulse h-2.5 w-2.5 rounded-full bg-primary" />}
              {running ? "Generator running" : "Generator off"}
            </div>
            <div className="mt-2 font-num text-5xl font-bold">{formatClock(elapsed)}</div>
            {running && <div className="mt-1 text-sm text-muted-foreground">Started {new Date(running.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
          </div>
          {running && <ReasonPicker value={reason} onChange={setReason} />}
          {!running ? (
            <Button className="h-20 w-full text-xl" onClick={startRun}><Play className="size-6" /> Start Generator</Button>
          ) : (
            <div className="space-y-2">
              <Button variant="destructive" className="h-20 w-full text-xl" disabled={!reason}
                onClick={() => { if (reason) { stopRun(reason); onDone(); } }}>
                <Square className="size-6" /> Stop Generator
              </Button>
              {!reason && <p className="text-center text-sm text-muted-foreground">Pick a reason to stop and save</p>}
              <Button variant="ghost" className="w-full" onClick={cancelRun}>Discard this run</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="hours">Hours run</Label>
            <Input id="hours" inputMode="decimal" autoFocus className="h-14 font-num text-2xl" value={hours}
              onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="2.5" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rdate">Date</Label>
            <Input id="rdate" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ReasonPicker value={reason} onChange={setReason} />
          <div className="flex gap-3">
            {entry && <Button variant="destructive" className="h-14" onClick={() => { deleteRuntime(entry.id); onDone(); }}>Delete</Button>}
            <Button variant="secondary" className="h-14 flex-1" onClick={onDone}>Cancel</Button>
            <Button className="h-14 flex-1 text-lg" disabled={!(h > 0 && h <= 744) || !reason} onClick={() => {
              if (!reason) return;
              saveRuntime({ id: entry?.id, hours: h, reason, date: new Date(date).toISOString(),
                startTime: entry?.startTime, endTime: entry?.endTime });
              onDone();
            }}>Save</Button>
          </div>
        </div>
      )}
    </FormShell>
  );
}
