import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const REASONS = ["Scheduled outage", "Unscheduled outage", "Maintenance test", "Other"] as const;

export type ParsedEntry =
  | { kind: "fuel"; litres: number; pricePerLitre: number; date: string; note: string | null }
  | { kind: "runtime"; hours: number; reason: (typeof REASONS)[number]; date: string }
  | { kind: "unclear"; message: string };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "litres", "pricePerLitre", "totalCost", "hours", "reason", "date", "note", "message"],
  properties: {
    kind: { type: "string", enum: ["fuel", "runtime", "unclear"] },
    litres: { type: ["number", "null"] },
    pricePerLitre: { type: ["number", "null"] },
    totalCost: { type: ["number", "null"], description: "Total paid, if stated instead of price per litre" },
    hours: { type: ["number", "null"] },
    reason: { type: ["string", "null"], enum: [...REASONS, null] },
    date: { type: ["string", "null"], description: "Local date-time YYYY-MM-DDTHH:mm" },
    note: { type: ["string", "null"] },
    message: { type: ["string", "null"], description: "If unclear, a short question asking what is missing" },
  },
} as const;

export const parseEntry = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      text: z.string().trim().min(3).max(500),
      now: z.string().max(40),
      currency: z.string().max(5),
      lastPrice: z.number().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<ParsedEntry> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI isn't set up yet.");

    const system = `You turn a generator owner's plain-language note into ONE log entry.
Current local date-time: ${data.now}. Currency: ${data.currency}. Last known fuel price per litre: ${data.lastPrice ?? "unknown"}.
- Fuel purchase/top-up -> kind "fuel". If only a total is given, set totalCost. If no price at all, use the last known price.
- Generator running time -> kind "runtime" with decimal hours and the best-fitting reason (power cut = Unscheduled outage unless planned; testing/servicing = Maintenance test).
- Resolve relative dates ("yesterday evening") into YYYY-MM-DDTHH:mm. Default to now.
- If it isn't one of these or a key number is missing, kind "unclear" with a short question in message.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          { role: "system", content: system },
          { role: "user", content: data.text },
        ],
        text: { format: { type: "json_schema", name: "log_entry", strict: true, schema } },
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("Too many requests right now — try again in a minute.");
      if (res.status === 402) throw new Error("AI credits have run out for this workspace.");
      if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
      throw new Error("The AI couldn't read that right now. Please try again.");
    }

    // Consume the stream server-side and collect the final text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
          if (ev.type === "response.refusal.delta" || ev.type === "error") {
            return { kind: "unclear", message: "Sorry, I couldn't turn that into an entry." };
          }
        } catch { /* partial line */ }
      }
    }

    let p: Record<string, unknown>;
    try { p = JSON.parse(out); } catch {
      return { kind: "unclear", message: "Sorry, I couldn't understand that. Try including litres or hours." };
    }
    const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
    const date = typeof p["date"] === "string" && p["date"] ? String(p["date"]) : data.now;

    if (p["kind"] === "fuel") {
      const litres = num(p["litres"]);
      const total = num(p["totalCost"]);
      const price = num(p["pricePerLitre"]) ?? (litres && total ? total / litres : data.lastPrice);
      if (litres && price) {
        return { kind: "fuel", litres, pricePerLitre: Math.round(price * 100) / 100, date, note: (p["note"] as string | null) ?? null };
      }
      return { kind: "unclear", message: "How many litres, and what did you pay?" };
    }
    if (p["kind"] === "runtime") {
      const hours = num(p["hours"]);
      const reason = REASONS.includes(p["reason"] as never) ? (p["reason"] as (typeof REASONS)[number]) : "Other";
      if (hours) return { kind: "runtime", hours: Math.round(hours * 100) / 100, reason, date };
      return { kind: "unclear", message: "How long did the generator run?" };
    }
    return { kind: "unclear", message: (p["message"] as string) || "Tell me about fuel you bought or how long the generator ran." };
  });
