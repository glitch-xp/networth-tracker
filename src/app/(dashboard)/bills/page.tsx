import { Receipt } from "lucide-react";

export const metadata = {
  title: "Bills — FinanceOS",
  description: "Track recurring bills and subscriptions",
};

export default function BillsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Recurring bills and subscriptions
        </p>
      </div>
      <div className="card flex flex-col items-center py-20 text-center">
        <Receipt className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-lg font-semibold text-[var(--text-secondary)]">
          Coming in Chunk 6
        </p>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Automatic bill detection, subscription tracking, and payment reminders
        </p>
      </div>
    </div>
  );
}
