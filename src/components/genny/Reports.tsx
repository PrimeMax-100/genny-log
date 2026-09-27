import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGenny, formatMoney, formatHours, startOfWeek, startOfMonth } from "@/lib/genny-store";
import { REASONS } from "@/lib/genny-storage";

interface Bucket { label: string; cost: number; hours: number }

export function Reports() {
  const { fuel, runtime, data } = useGenny();
  const cur = data.settings.currency;
  const [range, setRange] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<"cost" | "hours">("cost");

  const buckets = useMemo<Bucket[]>(() => {
    const now = new Date();
    if (range === "week") {
      const start = startOfWeek(now);
      return Array.from({ length: 7 }, (_, i) => {
        const s = new Date(start); s.setDate(s.getDate() + i);
        const e = new Date(s); e.setDate(e.getDate() + 1);
        return mk(s.toLocaleDateString([], { weekday: "short" }), s, e);
      });
    }
    const start = startOfMonth(now);
    const next = new Date(start); next.setMonth(next.getMonth() + 1);
    const out: Bucket[] = [];
    for (let i = 0, s = new Date(start); s < next; i++) {
      const e = new Date(s); e.setDate(e.getDate() + 7);
      out.push(mk(`Wk ${i + 1}`, s, e < next ? e : next));
      s = e;
    }
    return out;
    function mk(label: string, s: Date, e: Date): Bucket {
      const inR = (d: string) => { const t = new Date(d); return t >= s && t < e; };
      return {
        label,
        cost: fuel.filter((f) => inR(f.date)).reduce((a, f) => a + f.totalCost, 0),
        hours: runtime.filter((r) => inR(r.date)).reduce((a, r) => a + r.hours, 0),
      };
    }
  }, [fuel, runtime, range]);

  const max = Math.max(1e-9, ...buckets.map((b) => b[metric]));
  const monthRuns = runtime.filter((r) => new Date(r.date) >= startOfMonth());
  const monthHours = monthRuns.reduce((a, r) => a + r.hours, 0);
  const byReason = REASONS.map((reason) => {
    const h = monthRuns.filter((r) => r.reason === reason).reduce((a, r) => a + r.hours, 0);
    return { reason, h, pct: monthHours ? Math.round((h / monthHours) * 100) : 0 };
  }).sort((a, b) => b.h - a.h);
  const top = byReason[0]!;
  const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">History</h1>
      <div className="flex gap-2">
        <Tabs value={range} onValueChange={(v) => setRange(v as "week" | "month")} className="flex-1">
          <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="week">This week</TabsTrigger><TabsTrigger value="month">This month</TabsTrigger></TabsList>
        </Tabs>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as "cost" | "hours")}>
          <TabsList><TabsTrigger value="cost">Cost</TabsTrigger><TabsTrigger value="hours">Hours</TabsTrigger></TabsList>
        </Tabs>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex h-48 items-end gap-2">
          {buckets.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="font-num text-[10px] text-muted-foreground">
                {b[metric] ? (metric === "cost" ? formatMoney(b.cost, cur).replace(/\.00$/, "") : b.hours.toFixed(1)) : ""}
              </div>
              <div className="w-full rounded-t-md bg-primary transition-all" style={{ height: `${(b[metric] / max) * 100}%`, minHeight: b[metric] ? 4 : 0 }} />
              <div className="text-xs text-muted-foreground">{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Why it ran this month</h2>
        {monthHours === 0 ? (
          <p className="text-sm text-muted-foreground">No runtime logged this month yet.</p>
        ) : (
          <>
            <p className="text-sm"><span className="font-num font-bold text-primary">{top.pct}%</span> of runtime this month was <span className="font-medium">{top.reason.toLowerCase()}</span>.</p>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {byReason.map((r) => <div key={r.reason} className={colors[REASONS.indexOf(r.reason)]} style={{ width: `${r.pct}%` }} />)}
            </div>
            <ul className="space-y-1.5 text-sm">
              {byReason.map((r) => (
                <li key={r.reason} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${colors[REASONS.indexOf(r.reason)]}`} />
                  <span className="flex-1">{r.reason}</span>
                  <span className="font-num text-muted-foreground">{formatHours(r.h)} · {r.pct}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
