import { createClient } from "@/lib/supabase/server";
import { AccountsList } from "@/features/accounts/accounts-list";
import type { FinancialAccount } from "@/lib/supabase/types";

export const metadata = {
  title: "Accounts — FinanceOS",
  description: "Manage your financial accounts and balances",
};

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return <AccountsList initialAccounts={(data as FinancialAccount[]) || []} />;
}
