// Single storage module for Genny Log. Swap these functions for a backend later
// without touching UI code.

export type FuelType = "Petrol" | "Diesel";
export type Reason = "Scheduled outage" | "Unscheduled outage" | "Maintenance test" | "Other";
export const REASONS: Reason[] = ["Scheduled outage", "Unscheduled outage", "Maintenance test", "Other"];
export type Currency = "NGN" | "USD" | "GHS" | "KES" | "GBP" | "EUR" | "CAD" | "ZAR" | "AUD" | "INR";
export const CURRENCIES: Currency[] = ["NGN", "USD", "GHS", "KES", "GBP", "EUR", "CAD", "ZAR", "AUD", "INR"];

const EURO = ["DE","FR","IE","IT","ES","PT","NL","BE","AT","FI","GR","LU","SK","SI","EE","LV","LT","MT","CY","HR"];
function countryToCurrency(cc: string): Currency | null {
  cc = cc.toUpperCase();
  const map: Record<string, Currency> = { NG: "NGN", US: "USD", GH: "GHS", KE: "KES", GB: "GBP", CA: "CAD", ZA: "ZAR", AU: "AUD", IN: "INR" };
  if (map[cc]) return map[cc]!;
  if (EURO.includes(cc)) return "EUR";
  return null;
}
const TZ: Record<string, Currency> = {
  "Africa/Lagos": "NGN", "Africa/Accra": "GHS", "Africa/Nairobi": "KES", "Africa/Johannesburg": "ZAR",
  "Europe/London": "GBP", "Asia/Kolkata": "INR", "Asia/Calcutta": "INR",
};
/** Infer currency from timezone first, then browser locale region. Falls back to USD. */
export function detectCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (TZ[tz]) return TZ[tz]!;
    if (tz.startsWith("Australia/")) return "AUD";
    if (["America/Toronto","America/Vancouver","America/Edmonton","America/Winnipeg","America/Halifax","America/Regina","America/St_Johns"].includes(tz)) return "CAD";
    const langs = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
    for (const l of langs) {
      const region = l?.split("-")[1];
      const c = region && countryToCurrency(region);
      if (c) return c;
    }
    if (tz.startsWith("Europe/")) return "EUR";
    if (tz.startsWith("America/")) return "USD";
  } catch { /* ignore */ }
  return "USD";
}

export interface Generator { id: string; name: string; fuelType: FuelType; createdAt: string }
export interface FuelEntry {
  id: string; generatorId: string; litres: number; pricePerLitre: number;
  totalCost: number; date: string; note?: string | undefined;
}
export interface RuntimeEntry {
  id: string; generatorId: string; startTime?: string | undefined; endTime?: string | undefined;
  hours: number; reason: Reason; date: string;
}
export interface ActiveRun { generatorId: string; startTime: string }

export interface GennyData {
  version: 1;
  generators: Generator[];
  activeGeneratorId: string;
  fuel: FuelEntry[];
  runtime: RuntimeEntry[];
  settings: {
    currency: Currency; theme: "dark" | "light";
    currencyManuallySet: boolean; currencyAutoDetected: boolean; currencyNoticeDismissed: boolean;
    showAiQuickEntry: boolean;
  };
  activeRun: ActiveRun | null;
}

const KEY = "gennylog:v1";
const ONBOARDING_KEY = "gennylog:onboarding-seen";
let autoStartOnboarding = false;

export function shouldAutoStartOnboarding() {
  return autoStartOnboarding;
}

export function markOnboardingSeen() {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(ONBOARDING_KEY, "true"); } catch { /* storage unavailable */ }
  autoStartOnboarding = false;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function defaultData(): GennyData {
  const g: Generator = { id: uid(), name: "My Generator", fuelType: "Petrol", createdAt: new Date().toISOString() };
  return {
    version: 1, generators: [g], activeGeneratorId: g.id, fuel: [], runtime: [],
    settings: { currency: "NGN", theme: "dark", currencyManuallySet: false, currencyAutoDetected: false, currencyNoticeDismissed: false, showAiQuickEntry: true },
    activeRun: null,
  };
}

function withDetection(d: GennyData): GennyData {
  if (d.settings.currencyManuallySet || d.settings.currencyAutoDetected) return d;
  return { ...d, settings: { ...d.settings, currency: detectCurrency(), currencyAutoDetected: true } };
}

export function loadData(): GennyData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = window.localStorage.getItem(KEY);
    const hasSeenOnboarding = window.localStorage.getItem(ONBOARDING_KEY) === "true";
    autoStartOnboarding = !raw && !hasSeenOnboarding;
    if (!raw) return withDetection(defaultData());
    const parsed = JSON.parse(raw) as GennyData;
    if (!parsed.generators?.length) return withDetection(defaultData());
    const hadSettings = !!parsed.settings && "currencyAutoDetected" in parsed.settings;
    const merged = { ...defaultData(), ...parsed, settings: { ...defaultData().settings, ...parsed.settings } };
    // Existing users from before detection existed: treat their saved currency as chosen.
    if (!hadSettings && parsed.settings?.currency) {
      merged.settings = { ...merged.settings, currencyManuallySet: true, currencyNoticeDismissed: true };
    }
    return withDetection(merged);
  } catch {
    return withDetection(defaultData());
  }
}

export function saveData(data: GennyData) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full */ }
}
