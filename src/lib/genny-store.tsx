import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadData, saveData, uid, defaultData,
  type GennyData, type FuelEntry, type RuntimeEntry, type Currency, type Generator,
} from "./genny-storage";

const LOCALE: Record<Currency, string> = {
  NGN: "en-NG", USD: "en-US", GHS: "en-GH", KES: "en-KE", GBP: "en-GB", EUR: "en-IE", CAD: "en-CA",
  ZAR: "en-ZA", AUD: "en-AU", INR: "en-IN",
};

export function formatMoney(n: number, c: Currency, decimals = 0) {
  return new Intl.NumberFormat(LOCALE[c], {
    style: "currency", currency: c, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n || 0);
}

export function formatHours(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

export function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function startOfWeek(d = new Date()) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
export function startOfMonth(d = new Date()) { const x = startOfDay(d); x.setDate(1); return x; }

interface Ctx {
  data: GennyData;
  hydrated: boolean;
  generator: Generator;
  fuel: FuelEntry[];
  runtime: RuntimeEntry[];
  lastSavedAt: number;
  saveFuel: (e: Omit<FuelEntry, "id" | "generatorId" | "totalCost"> & { id?: string | undefined }) => void;
  saveRuntime: (e: Omit<RuntimeEntry, "id" | "generatorId"> & { id?: string | undefined }) => void;
  deleteFuel: (id: string) => void;
  deleteRuntime: (id: string) => void;
  startRun: () => void;
  stopRun: (reason: RuntimeEntry["reason"]) => void;
  cancelRun: () => void;
  updateGenerator: (patch: Partial<Generator>) => void;
  setCurrency: (c: Currency) => void;
  dismissCurrencyNotice: () => void;
  setTheme: (t: "dark" | "light") => void;
  setShowAiQuickEntry: (show: boolean) => void;
}

// Keep one context instance across hot reloads so Provider and consumers never mismatch.
const g = globalThis as unknown as { __gennyCtx?: React.Context<Ctx | null> };
const GennyCtx = g.__gennyCtx ?? (g.__gennyCtx = createContext<Ctx | null>(null));

export function GennyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GennyData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(0);

  useEffect(() => { setData(loadData()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveData(data); }, [data, hydrated]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", data.settings.theme === "dark");
  }, [data.settings.theme]);

  const update = useCallback((fn: (d: GennyData) => GennyData, bump = false) => {
    setData((d) => fn(d));
    if (bump) setLastSavedAt(Date.now());
  }, []);

  const generator = (data.generators.find((g) => g.id === data.activeGeneratorId) ?? data.generators[0])!;
  const fuel = useMemo(() => data.fuel.filter((f) => f.generatorId === generator.id), [data.fuel, generator.id]);
  const runtime = useMemo(() => data.runtime.filter((r) => r.generatorId === generator.id), [data.runtime, generator.id]);

  const value: Ctx = {
    data, hydrated, generator, fuel, runtime, lastSavedAt,
    saveFuel: (e) => update((d) => {
      const entry: FuelEntry = {
        id: e.id ?? uid(), generatorId: generator.id, litres: e.litres, pricePerLitre: e.pricePerLitre,
        totalCost: Math.round(e.litres * e.pricePerLitre * 100) / 100, date: e.date, note: e.note,
      };
      return { ...d, fuel: e.id ? d.fuel.map((f) => (f.id === e.id ? entry : f)) : [entry, ...d.fuel] };
    }, true),
    saveRuntime: (e) => update((d) => {
      const entry: RuntimeEntry = { ...e, id: e.id ?? uid(), generatorId: generator.id };
      return { ...d, runtime: e.id ? d.runtime.map((r) => (r.id === e.id ? entry : r)) : [entry, ...d.runtime] };
    }, true),
    deleteFuel: (id) => update((d) => ({ ...d, fuel: d.fuel.filter((f) => f.id !== id) }), true),
    deleteRuntime: (id) => update((d) => ({ ...d, runtime: d.runtime.filter((r) => r.id !== id) }), true),
    startRun: () => update((d) => ({ ...d, activeRun: { generatorId: generator.id, startTime: new Date().toISOString() } })),
    stopRun: (reason) => update((d) => {
      if (!d.activeRun) return d;
      const end = new Date();
      const hours = Math.max(0, (end.getTime() - new Date(d.activeRun.startTime).getTime()) / 3600000);
      const entry: RuntimeEntry = {
        id: uid(), generatorId: d.activeRun.generatorId, startTime: d.activeRun.startTime,
        endTime: end.toISOString(), hours: Math.round(hours * 1000) / 1000, reason, date: d.activeRun.startTime,
      };
      return { ...d, activeRun: null, runtime: [entry, ...d.runtime] };
    }, true),
    cancelRun: () => update((d) => ({ ...d, activeRun: null })),
    updateGenerator: (patch) => update((d) => ({
      ...d, generators: d.generators.map((g) => (g.id === generator.id ? { ...g, ...patch } : g)),
    })),
    setCurrency: (c) => update((d) => ({ ...d, settings: { ...d.settings, currency: c, currencyManuallySet: true, currencyNoticeDismissed: true } })),
    dismissCurrencyNotice: () => update((d) => ({ ...d, settings: { ...d.settings, currencyNoticeDismissed: true } })),
    setTheme: (t) => update((d) => ({ ...d, settings: { ...d.settings, theme: t } })),
    setShowAiQuickEntry: (show) => update((d) => ({ ...d, settings: { ...d.settings, showAiQuickEntry: show } })),
  };

  return <GennyCtx.Provider value={value}>{children}</GennyCtx.Provider>;
}

export function useGenny() {
  const c = useContext(GennyCtx);
  if (!c) throw new Error("useGenny must be used inside GennyProvider");
  return c;
}

/** Elapsed seconds ticking every second for a running generator. */
export function useElapsed(startIso: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startIso]);
  return startIso ? Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000)) : 0;
}

export function formatClock(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

// TODO(fuel-price-api): replace this mock with a real fuel-price API call.
export async function fetchFuelPrice(fuelType: Generator["fuelType"], currency: Currency): Promise<number> {
  await new Promise((r) => setTimeout(r, 1000));
  const baseUsd = fuelType === "Diesel" ? 1.05 : 0.95;
  const mockRate: Record<Currency, number> = { NGN: 1150, USD: 1, GHS: 15, KES: 130, GBP: 0.78, EUR: 0.92, CAD: 1.36, ZAR: 18.5, AUD: 1.52, INR: 83 };
  const jitter = 1 + (Math.random() - 0.5) * 0.04;
  return Math.round(baseUsd * mockRate[currency] * jitter * 100) / 100;
}
