"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Plus,
  Search,
  X,
  Smartphone,
  Mail,
  Merge,
} from "lucide-react";
import type {
  Transaction,
  TransactionType,
  TransactionDirection,
  FinancialAccount,
} from "@/lib/supabase/types";

export type TransactionWithSources = Transaction & {
  transaction_sources?: { source_type: string }[];
};

interface TransactionsListProps {
  initialTransactions: TransactionWithSources[];
  accounts: FinancialAccount[];
}

const typeLabels: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  investment: "Investment",
  refund: "Refund",
  fee: "Fee",
  tax: "Tax",
  dividend: "Dividend",
  interest: "Interest",
  other: "Other",
};

const categories = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Bills & Utilities",
  "Health & Fitness",
  "Education",
  "Travel",
  "Groceries",
  "Salary",
  "Freelance",
  "Investment",
  "Transfer",
  "Other",
];

export function TransactionsList({
  initialTransactions,
  accounts,
}: TransactionsListProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<TransactionType | "all">("all");
  const [form, setForm] = useState({
    transaction_type: "expense" as TransactionType,
    direction: "debit" as TransactionDirection,
    amount: "",
    currency: "INR",
    merchant: "",
    description: "",
    category: "",
    occurred_at: new Date().toISOString().slice(0, 16),
    account_id: "",
    is_transfer: false,
    transfer_account_id: "",
  });

  const supabase = createClient();

  const resetForm = () => {
    setForm({
      transaction_type: "expense",
      direction: "debit",
      amount: "",
      currency: "INR",
      merchant: "",
      description: "",
      category: "",
      occurred_at: new Date().toISOString().slice(0, 16),
      account_id: "",
      is_transfer: false,
      transfer_account_id: "",
    });
    setShowForm(false);
  };

  const handleTypeChange = (type: TransactionType) => {
    const direction: TransactionDirection =
      type === "income" || type === "refund" || type === "dividend" || type === "interest"
        ? "credit"
        : "debit";
    setForm({
      ...form,
      transaction_type: type,
      direction,
      is_transfer: type === "transfer",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        transaction_type: form.transaction_type,
        direction: form.direction,
        amount: form.amount,
        currency: form.currency,
        merchant: form.merchant || null,
        description: form.description || null,
        category: form.category || null,
        occurred_at: new Date(form.occurred_at).toISOString(),
        account_id: form.account_id || null,
        is_transfer: form.is_transfer,
        transfer_account_id: form.transfer_account_id || null,
        status: "confirmed",
        needs_review: false,
        user_id: (await supabase.auth.getUser()).data.user!.id,
      } as never)
      .select()
      .single();

    if (data && !error) {
      setTransactions([data as Transaction, ...transactions]);
      resetForm();
    }
  };

  const handleVoid = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: "voided" } as never)
      .eq("id", id);

    if (!error) {
      setTransactions(
        transactions.map((t) =>
          t.id === id ? { ...t, status: "voided" as const } : t
        )
      );
    }
  };

  // Filter and search
  const filtered = transactions.filter((t) => {
    if (filterType !== "all" && t.transaction_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.merchant?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          id="add-transaction-button"
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-5 animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Add Transaction</h2>
            <button onClick={resetForm} className="btn btn-ghost p-1">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Type *
                </label>
                <select
                  id="transaction-type-select"
                  className="input"
                  value={form.transaction_type}
                  onChange={(e) =>
                    handleTypeChange(e.target.value as TransactionType)
                  }
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Amount *
                </label>
                <input
                  id="transaction-amount-input"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Date *
                </label>
                <input
                  id="transaction-date-input"
                  type="datetime-local"
                  className="input"
                  value={form.occurred_at}
                  onChange={(e) =>
                    setForm({ ...form, occurred_at: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Merchant
                </label>
                <input
                  id="transaction-merchant-input"
                  type="text"
                  className="input"
                  placeholder="e.g., Amazon"
                  value={form.merchant}
                  onChange={(e) =>
                    setForm({ ...form, merchant: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Category
                </label>
                <select
                  id="transaction-category-select"
                  className="input"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Account
                </label>
                <select
                  id="transaction-account-select"
                  className="input"
                  value={form.account_id}
                  onChange={(e) =>
                    setForm({ ...form, account_id: e.target.value })
                  }
                >
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {form.is_transfer && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    To Account
                  </label>
                  <select
                    id="transaction-transfer-account-select"
                    className="input"
                    value={form.transfer_account_id}
                    onChange={(e) =>
                      setForm({ ...form, transfer_account_id: e.target.value })
                    }
                  >
                    <option value="">Select destination</option>
                    {accounts
                      .filter((a) => a.id !== form.account_id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Description
                </label>
                <input
                  id="transaction-description-input"
                  type="text"
                  className="input"
                  placeholder="Optional note"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
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
                id="save-transaction-button"
                type="submit"
                className="btn btn-primary"
              >
                Add Transaction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            id="transaction-search-input"
            type="text"
            className="input pl-9"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          id="transaction-filter-select"
          className="input w-auto"
          value={filterType}
          onChange={(e) =>
            setFilterType(e.target.value as TransactionType | "all")
          }
        >
          <option value="all">All Types</option>
          {Object.entries(typeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Transaction List */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <ArrowRightLeft className="mb-3 h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              No transactions found
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {searchQuery || filterType !== "all"
                ? "Try adjusting your filters"
                : "Add your first transaction to get started"}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className={`table-row flex items-center gap-3 px-4 py-3 ${
                  tx.status === "voided" ? "opacity-40" : ""
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    tx.is_transfer
                      ? "bg-[rgba(59,130,246,0.12)]"
                      : tx.direction === "credit"
                        ? "bg-[rgba(16,185,129,0.12)]"
                        : "bg-[rgba(239,68,68,0.12)]"
                  }`}
                >
                  {tx.is_transfer ? (
                    <ArrowRightLeft className="h-4 w-4 text-[var(--color-info)]" />
                  ) : tx.direction === "credit" ? (
                    <ArrowDownRight className="h-4 w-4 text-[var(--color-positive)]" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-[var(--color-negative)]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {tx.merchant || tx.description || "Transaction"}
                    </p>
                    {tx.status === "voided" && (
                      <span className="badge badge-negative">Voided</span>
                    )}
                    {tx.needs_review && (
                      <span className="badge badge-warning">Review</span>
                    )}
                    {tx.is_transfer && (
                      <span className="badge badge-info">Transfer</span>
                    )}
                    {/* Source Provenance */}
                    {tx.transaction_sources && tx.transaction_sources.length > 0 && (
                      <div className="flex gap-1 ml-1">
                        {tx.transaction_sources.some(s => s.source_type === "sms") && (
                          <span title="Imported from SMS" className="flex items-center text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-1 py-0.5">
                            <Smartphone className="h-3 w-3" />
                          </span>
                        )}
                        {tx.transaction_sources.some(s => s.source_type === "gmail") && (
                          <span title="Imported from Gmail" className="flex items-center text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-1 py-0.5">
                            <Mail className="h-3 w-3" />
                          </span>
                        )}
                        {tx.transaction_sources.length > 1 && (
                          <span title="Merged from multiple sources" className="flex items-center text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded px-1 py-0.5">
                            <Merge className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {tx.category || typeLabels[tx.transaction_type]} ·{" "}
                    {new Date(tx.occurred_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {tx.currency}
                    </p>
                  </div>
                  {tx.status !== "voided" && (
                    <button
                      onClick={() => handleVoid(tx.id)}
                      className="btn btn-ghost p-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--color-negative)]"
                      title="Void transaction"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
