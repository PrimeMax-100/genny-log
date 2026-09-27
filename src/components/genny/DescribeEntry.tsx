import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Info, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseEntry } from "@/lib/ai-entry.functions";
import { useGenny } from "@/lib/genny-store";
import type { FuelDraft, RuntimeDraft } from "./Forms";

function localNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function DescribeEntry({ onFuel, onRuntime }: { onFuel: (d: FuelDraft) => void; onRuntime: (d: RuntimeDraft) => void }) {
  const { data, fuel } = useGenny();
  const parse = useServerFn(parseEntry);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState(false);

  const submit = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await parse({ data: { text, now: localNow(), currency: data.settings.currency, lastPrice: fuel[0]?.pricePerLitre ?? null } });
      const toIso = (s: string) => { const d = new Date(s); return isNaN(+d) ? new Date().toISOString() : d.toISOString(); };
      if (r.kind === "fuel") { setText(""); onFuel({ ...r, date: toIso(r.date) }); }
      else if (r.kind === "runtime") { setText(""); onRuntime({ ...r, date: toIso(r.date) }); }
      else setMsg(r.message);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 font-display font-semibold">
        <MessageSquareText className="size-4 text-primary" /> Just tell me what happened
      </div>
      <Textarea value={text} maxLength={500} rows={2} onChange={(e) => setText(e.target.value)}
        placeholder={`e.g. "Bought 25 litres for 30,000 this morning" or "Ran it 3 hours last night, NEPA took light"`}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <Button className="w-full" disabled={busy || text.trim().length < 3} onClick={submit}>
        {busy ? <><Loader2 className="animate-spin" /> Reading…</> : "Turn into entry"}
      </Button>
      <p className="text-xs text-muted-foreground">You'll check it before it's saved.</p>
      <button type="button" onClick={() => setInfo((v) => !v)}
        className="flex items-start gap-1.5 text-left text-xs text-muted-foreground/80 hover:text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" />
        <span>Uses AI to read your entry — only this text is sent, nothing is stored.</span>
      </button>
      {info && (
        <p className="text-xs text-muted-foreground/80">
          No entry history, generator details, or device info is sent — only the text you type, the current date,
          your currency, and your last fuel price if needed to fill in a missing price.
        </p>
      )}
    </section>
  );
}
