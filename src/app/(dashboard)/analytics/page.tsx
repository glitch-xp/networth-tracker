import { BarChart3 } from "lucide-react";

export const metadata = {
  title: "Analytics — FinanceOS",
  description: "Spending analytics and financial trends",
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Spending patterns and financial trends
        </p>
      </div>
      <div className="card flex flex-col items-center py-20 text-center">
        <BarChart3 className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-lg font-semibold text-[var(--text-secondary)]">
          Coming in Chunk 6
        </p>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Category spending, trends, savings rate, and cash flow analysis
        </p>
      </div>
    </div>
  );
}
