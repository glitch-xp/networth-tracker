import { createClient } from "@/lib/supabase/server";
import { TransactionsList } from "@/features/transactions/transactions-list";
import type { Transaction, FinancialAccount } from "@/lib/supabase/types";

export const metadata = {
  title: "Transactions — FinanceOS",
  description: "View and manage your financial transactions",
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  const [txResult, accountsResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, transaction_sources(source_type)")
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("financial_accounts")
      .select("*")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <TransactionsList
      initialTransactions={(txResult.data as Transaction[]) || []}
      accounts={(accountsResult.data as FinancialAccount[]) || []}
    />
  );
}
