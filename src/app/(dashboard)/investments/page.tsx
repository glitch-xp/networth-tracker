import { TrendingUp } from "lucide-react";

export const metadata = {
  title: "Investments — FinanceOS",
  description: "Track your investment portfolio",
};

export default function InvestmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Investments</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Portfolio tracking and performance
        </p>
      </div>
      <div className="card flex flex-col items-center py-20 text-center">
        <TrendingUp className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-lg font-semibold text-[var(--text-secondary)]">
          Coming in Chunk 4
        </p>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Investment tracking, market data, and portfolio valuation
        </p>
      </div>
    </div>
  );
}
