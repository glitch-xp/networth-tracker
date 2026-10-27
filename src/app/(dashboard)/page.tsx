import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/utils";
import type { FinancialAccount, BalanceSnapshot, Transaction } from "@/lib/supabase/types";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  CreditCard,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Clock,
} from "lucide-react";

export const metadata = {
  title: "Dashboard — FinanceOS",
  description: "Your financial overview at a glance",
};

async function getNetWorth(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Get all active accounts with their latest balance snapshots
  const { data: accountRows } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("is_active", true);

  const accounts = (accountRows ?? []) as unknown as FinancialAccount[];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let cashBalance = 0;

  for (const account of accounts) {
      // Get latest balance snapshot
      const { data: snapshotRow } = await supabase
        .from("balance_snapshots")
        .select("balance")
        .eq("account_id", account.id)
        .order("observed_at", { ascending: false })
        .limit(1)
        .single();

      const snapshot = snapshotRow as unknown as Pick<BalanceSnapshot, "balance"> | null;
      const balance = snapshot ? parseFloat(snapshot.balance) : 0;

      if (account.is_asset) {
        totalAssets += balance;
        if (
          account.account_type === "bank" ||
          account.account_type === "cash"
        ) {
          cashBalance += balance;
        }
      }
      if (account.is_liability) {
        totalLiabilities += balance;
      }
    }

  return {
    netWorth: totalAssets - totalLiabilities,
    assets: totalAssets,
    liabilities: totalLiabilities,
    cash: cashBalance,
    investments: 0, // Will be populated in Chunk 4
    crypto: 0, // Will be populated in Chunk 5
  };
}

async function getRecentTransactions(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(5);

  return (data ?? []) as unknown as Transaction[];
}

async function getReviewCount(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { count } = await supabase
    .from("review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return count || 0;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const [netWorthData, recentTransactions, reviewCount] = await Promise.all([
    getNetWorth(supabase),
    getRecentTransactions(supabase),
    getReviewCount(supabase),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Your financial overview at a glance
        </p>
      </div>

      {/* Net Worth Hero Card */}
      <div className="glass p-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <p className="stat-label">Net Worth</p>
            <p className="stat-value mt-1">
              {formatINR(netWorthData.netWorth)}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="stat-change positive flex items-center gap-0.5">
                <TrendingUp className="h-3.5 w-3.5" />
                —
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                this month
              </span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary-glow)]">
            <Wallet className="h-5 w-5 text-[var(--accent-primary)]" />
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assets"
          value={formatINR(netWorthData.assets)}
          icon={<TrendingUp className="h-4.5 w-4.5" />}
          color="positive"
        />
        <StatCard
          label="Liabilities"
          value={formatINR(netWorthData.liabilities)}
          icon={<CreditCard className="h-4.5 w-4.5" />}
          color="negative"
        />
        <StatCard
          label="Cash"
          value={formatINR(netWorthData.cash)}
          icon={<Landmark className="h-4.5 w-4.5" />}
          color="info"
        />
        <StatCard
          label="Crypto"
          value={formatINR(netWorthData.crypto)}
          icon={<Coins className="h-4.5 w-4.5" />}
          color="warning"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <a
              href="/transactions"
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              View all →
            </a>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)]">
                <ArrowUpRight className="h-5 w-5 text-[var(--text-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                No transactions yet
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Add a transaction manually or connect a source
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="table-row flex items-center gap-3 px-2 py-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      tx.direction === "credit"
                        ? "bg-[rgba(16,185,129,0.12)]"
                        : "bg-[rgba(239,68,68,0.12)]"
                    }`}
                  >
                    {tx.direction === "credit" ? (
                      <ArrowDownRight className="h-4 w-4 text-[var(--color-positive)]" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-[var(--color-negative)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.merchant || tx.description || "Transaction"}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {tx.category || tx.transaction_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        tx.direction === "credit"
                          ? "text-[var(--color-positive)]"
                          : ""
                      }`}
                    >
                      {tx.direction === "debit" ? "-" : "+"}
                      {formatINR(tx.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Review Queue */}
          {reviewCount > 0 && (
            <div className="card border-[var(--color-warning)]/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(245,158,11,0.12)]">
                  <AlertCircle className="h-4.5 w-4.5 text-[var(--color-warning)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{reviewCount} items need review</p>
                  <a
                    href="/review"
                    className="text-xs text-[var(--accent-primary)] hover:underline"
                  >
                    Review now →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Bills placeholder */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Upcoming</h2>
              <a
                href="/bills"
                className="text-xs text-[var(--accent-primary)] hover:underline"
              >
                View all →
              </a>
            </div>
            <div className="flex flex-col items-center py-8 text-center">
              <Clock className="mb-2 h-8 w-8 text-[var(--text-tertiary)]" />
              <p className="text-xs text-[var(--text-tertiary)]">
                Bills will appear here once detected
              </p>
            </div>
          </div>

          {/* AI Insights placeholder */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Insights</h2>
              <span className="badge badge-info">AI</span>
            </div>
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-2 h-8 w-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <span className="text-base">✨</span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                Insights will generate once you have enough data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "positive" | "negative" | "info" | "warning";
}) {
  const bgMap = {
    positive: "rgba(16, 185, 129, 0.12)",
    negative: "rgba(239, 68, 68, 0.12)",
    info: "rgba(59, 130, 246, 0.12)",
    warning: "rgba(245, 158, 11, 0.12)",
  };
  const textMap = {
    positive: "var(--color-positive)",
    negative: "var(--color-negative)",
    info: "var(--color-info)",
    warning: "var(--color-warning)",
  };

  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="stat-label">{label}</p>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: bgMap[color], color: textMap[color] }}
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
