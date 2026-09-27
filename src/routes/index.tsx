import { createFileRoute } from "@tanstack/react-router";
import { GennyApp } from "@/components/genny/GennyApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Genny Log — What your generator really costs" },
      { name: "description", content: "Log fuel top-ups and generator runtime; see today's, this week's and this month's cost instantly." },
      { property: "og:title", content: "Genny Log — What your generator really costs" },
      { property: "og:description", content: "Log fuel top-ups and generator runtime; see today's, this week's and this month's cost instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GennyApp,
});
