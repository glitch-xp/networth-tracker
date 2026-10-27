import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Insights — FinanceOS",
  description: "AI-powered financial insights and recommendations",
};

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          AI-powered financial intelligence
        </p>
      </div>
      <div className="card flex flex-col items-center py-20 text-center">
        <Sparkles className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-lg font-semibold text-[var(--text-secondary)]">
          Coming in Chunk 7
        </p>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Gemini-powered financial analysis, anomaly detection, and natural-language Q&A
        </p>
      </div>
    </div>
  );
}
