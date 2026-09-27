import { useCallback, useEffect, useRef, useState } from "react";
import { Fuel, Timer, Home, BarChart3, Settings as SettingsIcon, RefreshCw, Loader2, Moon, Sun, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GennyProvider, useGenny, formatMoney, formatHours, startOfDay, startOfWeek, startOfMonth,
  useElapsed, formatClock, fetchFuelPrice,
} from "@/lib/genny-store";
import {
  CURRENCIES, markOnboardingSeen, shouldAutoStartOnboarding,
  type Currency, type FuelEntry, type RuntimeEntry,
} from "@/lib/genny-storage";
import { FuelForm, RuntimeForm, type FuelDraft, type RuntimeDraft } from "./Forms";
import { DescribeEntry } from "./DescribeEntry";
import { Reports } from "./Reports";
import { cn } from "@/lib/utils";

type View =
  | { name: "home" } | { name: "history" } | { name: "settings" }
  | { name: "fuel"; entry?: FuelEntry | undefined; draft?: FuelDraft | undefined }
  | { name: "runtime"; entry?: RuntimeEntry | undefined; draft?: RuntimeDraft | undefined };

export function GennyApp() {
  return <GennyProvider><Shell /></GennyProvider>;
}

function Shell() {
  const [view, setView] = useState<View>({ name: "home" });
  const [tourOpen, setTourOpen] = useState(false);
  const home = () => setView({ name: "home" });
  const { data, hydrated, fuel, runtime } = useGenny();
  useEffect(() => { window.scrollTo(0, 0); }, [view.name]);
  useEffect(() => {
    if (hydrated && fuel.length === 0 && runtime.length === 0 && shouldAutoStartOnboarding()) setTourOpen(true);
  }, [fuel.length, hydrated, runtime.length]);

  const closeTour = useCallback(() => {
    markOnboardingSeen();
    setTourOpen(false);
  }, []);

  const replayTour = useCallback(() => {
    setView({ name: "home" });
    window.setTimeout(() => setTourOpen(true), 0);
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-md pb-28">
      {data.activeRun && view.name !== "runtime" && <RunningBar onOpen={() => setView({ name: "runtime" })} />}
      <main className="px-4 pt-5">
        {view.name === "home" && <Dashboard go={setView} />}
        {view.name === "fuel" && <FuelForm key={view.draft ? "d" + view.draft.date : "f"} entry={view.entry} draft={view.draft} onDone={home} />}
        {view.name === "runtime" && <RuntimeForm key={view.draft ? "d" + view.draft.date : "r"} entry={view.entry} draft={view.draft} onDone={home} />}
        {view.name === "history" && <Reports />}
        {view.name === "settings" && <Settings onReplayTour={replayTour} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {([["home", "Home", Home], ["history", "History", BarChart3], ["settings", "Settings", SettingsIcon]] as const).map(([n, label, Icon]) => (
            <button key={n} data-tour={n === "settings" ? "settings" : undefined} onClick={() => setView({ name: n } as View)}
              className={cn("flex flex-col items-center gap-1 py-3 text-xs", view.name === n ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />{label}
            </button>
          ))}
        </div>
      </nav>
      {tourOpen && (
        <OnboardingTour
          showAi={data.settings.showAiQuickEntry !== false}
          onClose={closeTour}
        />
      )}
    </div>
  );
}

type TourStep = {
  target?: "log-actions" | "ai-entry" | "cost-card" | "settings";
  message: string;
};

function OnboardingTour({ showAi, onClose }: { showAi: boolean; onClose: () => void }) {
  const steps: TourStep[] = [
    { message: "Track what your generator really costs you — no account needed, everything stays on your device." },
    { target: "log-actions", message: "Log fuel top-ups and generator runtime here — takes a few seconds each time." },
    ...(showAi ? [{ target: "ai-entry" as const, message: "Or just type what happened in plain language and we'll fill in the details for you. Prefer to skip this? You can turn it off anytime in Settings." }] : []),
    { target: "cost-card", message: "Watch your real daily, weekly, and monthly cost build up automatically — no maths required." },
    { target: "settings", message: "Set your generator details and currency anytime here." },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    if (!step?.target) { setRect(null); return; }
    const update = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      setRect(element?.getBoundingClientRect() ?? null);
    };
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (step.target !== "settings") element?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = window.setTimeout(update, 220);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step?.target]);

  if (!step) return null;
  const isWelcome = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const spotlightStyle = rect ? {
    left: Math.max(8, rect.left - 6), top: Math.max(8, rect.top - 6),
    width: Math.min(window.innerWidth - 16, rect.width + 12), height: rect.height + 12,
  } : undefined;
  const placeAbove = !!rect && rect.bottom > window.innerHeight * 0.58;
  const tooltipStyle = rect ? {
    left: 16,
    right: 16,
    ...(placeAbove ? { bottom: window.innerHeight - rect.top + 18 } : { top: rect.bottom + 18 }),
  } : undefined;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Genny Log introduction">
      <button
        className={cn("absolute inset-0 size-full cursor-default", isWelcome && "bg-[var(--tour-dim)]")}
        aria-label="Skip onboarding tour"
        onClick={onClose}
      />
      {rect && <div className="tour-spotlight fixed rounded-2xl border-2 border-primary" style={spotlightStyle} />}
      <div
        key={stepIndex}
        className={cn(
          "tour-card fixed z-10 mx-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-xl",
          isWelcome ? "inset-x-4 top-1/2 max-w-sm -translate-y-1/2" : "max-w-md",
        )}
        style={isWelcome ? undefined : tooltipStyle}
      >
        {isWelcome && <h2 className="font-display text-2xl font-semibold">Welcome to Genny Log</h2>}
        <p className={cn("text-sm leading-relaxed", isWelcome && "mt-2 text-muted-foreground")}>{step.message}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Skip</Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{stepIndex + 1} of {steps.length}</span>
            <Button type="button" size="sm" autoFocus onClick={() => isLast ? onClose() : setStepIndex((i) => i + 1)}>
              {isWelcome ? "Get Started" : isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunningBar({ onOpen }: { onOpen: () => void }) {
  const { data } = useGenny();
  const s = useElapsed(data.activeRun?.startTime);
  return (
    <button onClick={onOpen} className="sticky top-0 z-30 flex w-full items-center gap-3 bg-primary px-4 py-2.5 text-primary-foreground">
      <span className="genny-pulse h-2.5 w-2.5 rounded-full bg-primary-foreground" />
      <span className="flex-1 text-left text-sm font-semibold">Generator running — tracking</span>
      <span className="font-num font-bold">{formatClock(s)}</span>
    </button>
  );
}

function useCountUp(target: number, key: number) {
  const [val, setVal] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current, t0 = performance.now(), dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(start + (target - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, key]);
  return val;
}

function Dashboard({ go }: { go: (v: View) => void }) {
  const { fuel, runtime, data, generator, lastSavedAt, hydrated, dismissCurrencyNotice } = useGenny();
  const cur = data.settings.currency;
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [priceOpen, setPriceOpen] = useState(false);

  const since = period === "today" ? startOfDay() : period === "week" ? startOfWeek() : startOfMonth();
  const spent = fuel.filter((f) => new Date(f.date) >= since).reduce((a, f) => a + f.totalCost, 0);
  const shown = useCountUp(spent, lastSavedAt);
  const monthStart = startOfMonth();
  const monthHours = runtime.filter((r) => new Date(r.date) >= monthStart).reduce((a, r) => a + r.hours, 0);
  const monthCost = fuel.filter((f) => new Date(f.date) >= monthStart).reduce((a, f) => a + f.totalCost, 0);
  const perHour = monthHours > 0 ? monthCost / monthHours : 0;

  const entries = [
    ...fuel.map((f) => ({ kind: "fuel" as const, date: f.date, f })),
    ...runtime.map((r) => ({ kind: "run" as const, date: r.date, r })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 30);

  // Pull-to-refresh on the cost card
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-primary"><Zap className="size-3.5" /> Genny Log</div>
          <h1 className="font-display text-xl font-semibold">{generator.name}</h1>
        </div>
        <button onClick={() => setPriceOpen(true)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="size-3.5" /> Today's price
        </button>
      </header>

      {hydrated && data.settings.currencyAutoDetected && !data.settings.currencyManuallySet && !data.settings.currencyNoticeDismissed && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-accent p-3 text-sm">
          <p className="flex-1">
            We set your currency to <strong>{cur}</strong> based on your location. You can change it any time in{" "}
            <button className="font-semibold text-primary underline" onClick={() => go({ name: "settings" })}>Settings</button>.
          </p>
          <button aria-label="Dismiss" className="text-muted-foreground hover:text-foreground" onClick={dismissCurrencyNotice}>✕</button>
        </div>
      )}

      <section
        data-tour="cost-card"
        className="rounded-2xl border bg-card p-5 transition-transform"
        style={{ transform: `translateY(${pull}px)` }}
        onTouchStart={(e) => { if (window.scrollY <= 0) startY.current = e.touches[0]!.clientY; }}
        onTouchMove={(e) => { if (startY.current !== null) setPull(Math.max(0, Math.min(70, (e.touches[0]!.clientY - startY.current) / 2))); }}
        onTouchEnd={() => { if (pull > 55) setPriceOpen(true); setPull(0); startY.current = null; }}
      >
        {pull > 0 && <div className="mb-2 text-center text-xs text-muted-foreground">{pull > 55 ? "Release to check fuel price" : "Pull to check fuel price"}</div>}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Fuel spent</div>
        <div className="font-num text-5xl font-bold leading-tight text-primary">{hydrated ? formatMoney(shown, cur) : "—"}</div>
      </section>

      <section data-tour="log-actions" className="grid grid-cols-2 gap-3">
        <Stat label="Hours this month" value={formatHours(monthHours)} />
        <Stat label="Avg cost / hour" value={perHour ? formatMoney(perHour, cur) : "—"} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Button className="h-24 flex-col gap-1 text-lg" onClick={() => go({ name: "fuel" })}><Fuel className="size-7" /> Log Fuel</Button>
        <Button variant="secondary" className="h-24 flex-col gap-1 border text-lg" onClick={() => go({ name: "runtime" })}>
          <Timer className="size-7" /> {data.activeRun ? "View Timer" : "Log Runtime"}
        </Button>
      </section>

      {data.settings.showAiQuickEntry !== false && (
        <div data-tour="ai-entry">
          <DescribeEntry
            onFuel={(d) => go({ name: "fuel", draft: d })}
            onRuntime={(d) => go({ name: "runtime", draft: d })}
          />
        </div>
      )}


      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">Recent</h2>
        {hydrated && entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-accent text-primary"><Fuel className="size-8" /></div>
            <p className="font-medium">Log your first fuel top-up to get started</p>
            <p className="mt-1 text-sm text-muted-foreground">We'll do the maths from there.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {entries.map((e) => e.kind === "fuel" ? (
              <li key={e.f.id}>
                <button onClick={() => go({ name: "fuel", entry: e.f })} className="flex w-full items-center gap-3 p-3 text-left">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-primary"><Fuel className="size-5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium">{e.f.litres} L @ {formatMoney(e.f.pricePerLitre, cur, 2)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{fmtDate(e.date)}{e.f.note ? ` · ${e.f.note}` : ""}</span>
                  </span>
                  <span className="font-num font-semibold">{formatMoney(e.f.totalCost, cur)}</span>
                </button>
              </li>
            ) : (
              <li key={e.r.id}>
                <button onClick={() => go({ name: "runtime", entry: e.r })} className="flex w-full items-center gap-3 p-3 text-left">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground"><Timer className="size-5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium">{e.r.reason}</span>
                    <span className="block text-xs text-muted-foreground">{fmtDate(e.date)}</span>
                  </span>
                  <span className="font-num font-semibold">{formatHours(e.r.hours)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PriceCheck open={priceOpen} onOpenChange={setPriceOpen} />
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-num text-xl font-bold">{value}</div>
    </div>
  );
}

/** Placeholder slot where an ad will be shown during the price refresh. No ad SDK yet. */
function AdSlotPlaceholder() {
  return (
    <div data-ad-slot="price-check" className="flex h-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
      Ad placeholder
    </div>
  );
}

function PriceCheck({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { generator, data } = useGenny();
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true); setPrice(null);
    fetchFuelPrice(generator.fuelType, data.settings.currency).then((p) => { if (alive) { setPrice(p); setLoading(false); } });
    return () => { alive = false; };
  }, [open, generator.fuelType, data.settings.currency]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Today's {generator.fuelType.toLowerCase()} price</DialogTitle></DialogHeader>
        <div className="py-4 text-center">
          {loading ? <Loader2 className="mx-auto size-8 animate-spin text-primary" /> : (
            <>
              <div className="font-num text-4xl font-bold text-primary">{formatMoney(price ?? 0, data.settings.currency, 2)}</div>
              <div className="text-sm text-muted-foreground">per litre · sample price</div>
            </>
          )}
        </div>
        <AdSlotPlaceholder />
      </DialogContent>
    </Dialog>
  );
}

function Settings({ onReplayTour }: { onReplayTour: () => void }) {
  const { generator, updateGenerator, data, setCurrency, setTheme, setShowAiQuickEntry } = useGenny();
  const [name, setName] = useState(generator.name);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="gname">Generator name</Label>
          <Input id="gname" maxLength={40} value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => updateGenerator({ name: name.trim() || "My Generator" })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fuel type</Label>
          <Tabs value={generator.fuelType} onValueChange={(v) => updateGenerator({ fuelType: v as "Petrol" | "Diesel" })}>
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="Petrol">Petrol</TabsTrigger><TabsTrigger value="Diesel">Diesel</TabsTrigger></TabsList>
          </Tabs>
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={data.settings.currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Appearance</Label>
          <Tabs value={data.settings.theme} onValueChange={(v) => setTheme(v as "dark" | "light")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dark"><Moon className="size-4" /> Dark</TabsTrigger>
              <TabsTrigger value="light"><Sun className="size-4" /> Light</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div className="space-y-1">
            <Label htmlFor="ai-quick">Show AI quick-entry on Home screen</Label>
            <p className="text-xs text-muted-foreground">Turn plain-language descriptions into draft entries.</p>
          </div>
          <Switch id="ai-quick" checked={data.settings.showAiQuickEntry !== false}
            onCheckedChange={(v) => setShowAiQuickEntry(v)} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div>
            <Label>Onboarding tour</Label>
            <p className="mt-1 text-xs text-muted-foreground">Review the Home screen introduction.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReplayTour}>Replay tour</Button>
        </div>
      </div>
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Tracking more than one generator is coming in a future update.
      </p>
    </div>
  );
}
