"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, timeAgo } from "@/lib/utils";
import {
  Plus,
  Building2,
  CreditCard,
  TrendingUp,
  Coins,
  Banknote,
  PiggyBank,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { AccountType, FinancialAccount } from "@/lib/supabase/types";

const accountTypeConfig: Record<
  AccountType,
  { label: string; icon: React.ElementType; color: string }
> = {
  bank: { label: "Bank", icon: Building2, color: "var(--color-info)" },
  credit_card: { label: "Credit Card", icon: CreditCard, color: "var(--color-negative)" },
  broker: { label: "Broker", icon: TrendingUp, color: "var(--color-positive)" },
  mutual_fund: { label: "Mutual Fund", icon: PiggyBank, color: "var(--color-positive)" },
  crypto_wallet: { label: "Crypto Wallet", icon: Coins, color: "var(--color-warning)" },
  cash: { label: "Cash", icon: Banknote, color: "var(--color-positive)" },
  loan: { label: "Loan", icon: CreditCard, color: "var(--color-negative)" },
  other: { label: "Other", icon: Building2, color: "var(--text-secondary)" },
};

export function AccountsList({
  initialAccounts,
}: {
  initialAccounts: FinancialAccount[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    institution: "",
    account_type: "bank" as AccountType,
    currency: "INR",
    masked_identifier: "",
    is_asset: true,
    is_liability: false,
  });

  const supabase = createClient();

  const resetForm = () => {
    setForm({
      name: "",
      institution: "",
      account_type: "bank",
      currency: "INR",
      masked_identifier: "",
      is_asset: true,
      is_liability: false,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleAccountTypeChange = (type: AccountType) => {
    const isLiability = type === "credit_card" || type === "loan";
    setForm({
      ...form,
      account_type: type,
      is_asset: !isLiability,
      is_liability: isLiability,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const { data, error } = await supabase
        .from("financial_accounts")
        .update({
          name: form.name,
          institution: form.institution || null,
          account_type: form.account_type,
          currency: form.currency,
          masked_identifier: form.masked_identifier || null,
          is_asset: form.is_asset,
          is_liability: form.is_liability,
        } as never)
        .eq("id", editingId)
        .select()
        .single();

      if (data && !error) {
        setAccounts(
          accounts.map((a) => (a.id === editingId ? (data as FinancialAccount) : a))
        );
      }
    } else {
      const { data, error } = await supabase
        .from("financial_accounts")
        .insert({
          name: form.name,
          institution: form.institution || null,
          account_type: form.account_type,
          currency: form.currency,
          masked_identifier: form.masked_identifier || null,
          is_asset: form.is_asset,
          is_liability: form.is_liability,
          user_id: (await supabase.auth.getUser()).data.user!.id,
        } as never)
        .select()
        .single();

      if (data && !error) {
        setAccounts([...accounts, data as FinancialAccount]);
      }
    }

    resetForm();
  };

  const handleEdit = (account: FinancialAccount) => {
    setForm({
      name: account.name,
      institution: account.institution || "",
      account_type: account.account_type,
      currency: account.currency,
      masked_identifier: account.masked_identifier || "",
      is_asset: account.is_asset,
      is_liability: account.is_liability,
    });
    setEditingId(account.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("financial_accounts")
      .update({ is_active: false } as never)
      .eq("id", id);

    if (!error) {
      setAccounts(accounts.filter((a) => a.id !== id));
    }
  };

  const assets = accounts.filter((a) => a.is_asset && !a.is_liability);
  const liabilities = accounts.filter((a) => a.is_liability);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Manage your financial accounts
          </p>
        </div>
        <button
          id="add-account-button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-5 animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {editingId ? "Edit Account" : "Add New Account"}
            </h2>
            <button onClick={resetForm} className="btn btn-ghost p-1">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Account Name *
                </label>
                <input
                  id="account-name-input"
                  type="text"
                  className="input"
                  placeholder="e.g., SBI Savings"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Institution
                </label>
                <input
                  id="account-institution-input"
                  type="text"
                  className="input"
                  placeholder="e.g., State Bank of India"
                  value={form.institution}
                  onChange={(e) =>
                    setForm({ ...form, institution: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Account Type *
                </label>
                <select
                  id="account-type-select"
                  className="input"
                  value={form.account_type}
                  onChange={(e) =>
                    handleAccountTypeChange(e.target.value as AccountType)
                  }
                >
                  {Object.entries(accountTypeConfig).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Currency
                </label>
                <select
                  id="account-currency-select"
                  className="input"
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value })
                  }
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Masked Identifier
                </label>
                <input
                  id="account-identifier-input"
                  type="text"
                  className="input"
                  placeholder="e.g., XXXX1234"
                  value={form.masked_identifier}
                  onChange={(e) =>
                    setForm({ ...form, masked_identifier: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                id="save-account-button"
                type="submit"
                className="btn btn-primary"
              >
                {editingId ? "Save Changes" : "Add Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assets */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Assets ({assets.length})
        </h2>
        {assets.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <Building2 className="mb-2 h-8 w-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              No asset accounts yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Liabilities */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Liabilities ({liabilities.length})
        </h2>
        {liabilities.length === 0 ? (
          <div className="card flex flex-col items-center py-12 text-center">
            <CreditCard className="mb-2 h-8 w-8 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              No liability accounts
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liabilities.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: FinancialAccount;
  onEdit: (a: FinancialAccount) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const config = accountTypeConfig[account.account_type];
  const Icon = config.icon;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
              color: config.color,
            }}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{account.name}</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {account.institution || config.label}
              {account.masked_identifier && ` · ${account.masked_identifier}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="btn btn-ghost p-1"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-lg">
              <button
                onClick={() => {
                  onEdit(account);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)]"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(account.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-[var(--color-negative)] hover:bg-red-500/10"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <span className="badge badge-neutral">{account.currency}</span>
      </div>
    </div>
  );
}
