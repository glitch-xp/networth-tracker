"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatINR, timeAgo } from "@/lib/utils";
import {
  Check,
  X,
  Pencil,
  Merge,
  Split,
  EyeOff,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type {
  ReviewQueueItem,
  Transaction,
  TransactionType,
} from "@/lib/supabase/types";

interface ReviewItemWithTransaction extends ReviewQueueItem {
  transaction?: Transaction;
}

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
  "Insurance",
  "Subscription",
  "Rent",
  "EMI",
  "Fuel",
  "Other",
];

export function ReviewQueue({
  initialItems,
}: {
  initialItems: ReviewItemWithTransaction[];
}) {
  const [items, setItems] = useState(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    amount: string;
    merchant: string;
    category: string;
    direction: "credit" | "debit";
    transaction_type: TransactionType;
  }>({
    amount: "",
    merchant: "",
    category: "",
    direction: "debit",
    transaction_type: "expense",
  });

  const supabase = createClient();
  const pendingItems = items.filter((i) => i.status === "pending");
  const resolvedItems = items.filter((i) => i.status !== "pending");

  // ─── Confirm: accept as-is ──────────────────────────
  const handleConfirm = async (item: ReviewItemWithTransaction) => {
    const sb = createClient();

    // Mark transaction as confirmed
    await sb
      .from("transactions")
      .update({ status: "confirmed", needs_review: false, review_reason: null } as never)
      .eq("id", item.entity_id);

    // Resolve review item
    await sb
      .from("review_queue")
      .update({ status: "confirmed", resolved_at: new Date().toISOString(), resolution: "confirmed_as_is" } as never)
      .eq("id", item.id);

    setItems(
      items.map((i) =>
        i.id === item.id
          ? { ...i, status: "confirmed" as const, resolved_at: new Date().toISOString() }
          : i
      )
    );
  };

  // ─── Reject: void the transaction ───────────────────
  const handleReject = async (item: ReviewItemWithTransaction) => {
    const sb = createClient();

    // Void the transaction
    await sb
      .from("transactions")
      .update({ status: "voided", needs_review: false } as never)
      .eq("id", item.entity_id);

    // Resolve review item
    await sb
      .from("review_queue")
      .update({ status: "rejected", resolved_at: new Date().toISOString(), resolution: "voided" } as never)
      .eq("id", item.id);

    setItems(
      items.map((i) =>
        i.id === item.id
          ? { ...i, status: "rejected" as const, resolved_at: new Date().toISOString() }
          : i
      )
    );
  };

  // ─── Edit: modify and confirm ───────────────────────
  const startEdit = (item: ReviewItemWithTransaction) => {
    if (item.transaction) {
      setEditForm({
        amount: item.transaction.amount,
        merchant: item.transaction.merchant || "",
        category: item.transaction.category || "",
        direction: item.transaction.direction,
        transaction_type: item.transaction.transaction_type,
      });
    }
    setEditingId(item.id);
  };

  const handleSaveEdit = async (item: ReviewItemWithTransaction) => {
    const sb = createClient();

    // Update transaction with corrections
    await sb
      .from("transactions")
      .update({
        amount: editForm.amount,
        merchant: editForm.merchant || null,
        category: editForm.category || null,
        direction: editForm.direction,
        transaction_type: editForm.transaction_type,
        status: "confirmed",
        needs_review: false,
        review_reason: null,
      } as never)
      .eq("id", item.entity_id);

    // Resolve review item
    await sb
      .from("review_queue")
      .update({
        status: "confirmed",
        resolved_at: new Date().toISOString(),
        resolution: "edited_and_confirmed",
      } as never)
      .eq("id", item.id);

    setItems(
      items.map((i) =>
        i.id === item.id
          ? { ...i, status: "confirmed" as const, resolved_at: new Date().toISOString() }
          : i
      )
    );
    setEditingId(null);
  };

  // ─── Ignore: dismiss without processing ──────────────
  const handleIgnore = async (item: ReviewItemWithTransaction) => {
    const sb = createClient();

    await sb
      .from("transactions")
      .update({ status: "voided", needs_review: false } as never)
      .eq("id", item.entity_id);

    await sb
      .from("review_queue")
      .update({ status: "rejected", resolved_at: new Date().toISOString(), resolution: "ignored" } as never)
      .eq("id", item.id);

    setItems(
      items.map((i) =>
        i.id === item.id
          ? { ...i, status: "rejected" as const, resolved_at: new Date().toISOString() }
          : i
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""} need
          your attention
        </p>
      </div>

      {/* Bulk actions */}
      {pendingItems.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="badge badge-warning">
            <AlertCircle className="mr-1 h-3 w-3" />
            {pendingItems.length} pending
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">
            AI-classified transactions that need confirmation
          </span>
        </div>
      )}

      {/* Pending Items */}
      {pendingItems.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-primary-glow)]">
            <Check className="h-7 w-7 text-[var(--accent-primary)]" />
          </div>
          <p className="text-lg font-semibold">All caught up!</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            No items need your review right now
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <div key={item.id} className="card animate-fade-in overflow-hidden">
              {/* Main row */}
              <div
                className="flex cursor-pointer items-center gap-3 p-4"
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
              >
                {/* Direction icon */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.transaction?.direction === "credit"
                      ? "bg-[rgba(16,185,129,0.12)]"
                      : "bg-[rgba(239,68,68,0.12)]"
                  }`}
                >
                  {item.transaction?.direction === "credit" ? (
                    <ArrowDownRight className="h-4 w-4 text-[var(--color-positive)]" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-[var(--color-negative)]" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {item.transaction?.merchant ||
                        item.transaction?.description ||
                        "Unknown Transaction"}
                    </p>
                    <span className="badge badge-warning text-[0.625rem]">
                      Needs Review
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {item.reason} · {timeAgo(item.created_at)}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      item.transaction?.direction === "credit"
                        ? "text-[var(--color-positive)]"
                        : ""
                    }`}
                  >
                    {item.transaction?.direction === "debit" ? "-" : "+"}
                    {formatINR(item.transaction?.amount || "0")}
                  </p>
                  {item.confidence !== null && (
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <Sparkles className="h-3 w-3 text-[var(--text-tertiary)]" />
                      <span className="text-[0.625rem] text-[var(--text-tertiary)]">
                        {Math.round((item.confidence ?? 0) * 100)}% confidence
                      </span>
                    </div>
                  )}
                </div>

                {/* Expand toggle */}
                {expandedId === item.id ? (
                  <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
                )}
              </div>

              {/* Expanded: Details + Actions */}
              {expandedId === item.id && (
                <div className="border-t border-[var(--border-subtle)] p-4">
                  {editingId === item.id ? (
                    // Edit form
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[0.625rem] font-medium text-[var(--text-tertiary)]">
                            Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="input"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm({ ...editForm, amount: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[0.625rem] font-medium text-[var(--text-tertiary)]">
                            Direction
                          </label>
                          <select
                            className="input"
                            value={editForm.direction}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                direction: e.target.value as "credit" | "debit",
                              })
                            }
                          >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[0.625rem] font-medium text-[var(--text-tertiary)]">
                            Merchant
                          </label>
                          <input
                            type="text"
                            className="input"
                            value={editForm.merchant}
                            onChange={(e) =>
                              setEditForm({ ...editForm, merchant: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[0.625rem] font-medium text-[var(--text-tertiary)]">
                            Category
                          </label>
                          <select
                            className="input"
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                          >
                            <option value="">Select</option>
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn btn-ghost text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(item)}
                          className="btn btn-primary text-xs"
                        >
                          Save & Confirm
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Details + action buttons
                    <div>
                      <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
                        <div>
                          <span className="text-[var(--text-tertiary)]">Category:</span>{" "}
                          <span className="font-medium">
                            {item.transaction?.category || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Type:</span>{" "}
                          <span className="font-medium">
                            {item.transaction?.transaction_type || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Status:</span>{" "}
                          <span className="font-medium">
                            {item.transaction?.status || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Date:</span>{" "}
                          <span className="font-medium">
                            {item.transaction?.occurred_at
                              ? new Date(item.transaction.occurred_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          id={`confirm-${item.id}`}
                          onClick={() => handleConfirm(item)}
                          className="btn btn-primary text-xs"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Confirm
                        </button>
                        <button
                          onClick={() => startEdit(item)}
                          className="btn btn-secondary text-xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit & Confirm
                        </button>
                        <button
                          onClick={() => handleReject(item)}
                          className="btn btn-secondary text-xs text-[var(--color-negative)]"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleIgnore(item)}
                          className="btn btn-ghost text-xs"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Ignore
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved Items */}
      {resolvedItems.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Recently Resolved ({resolvedItems.length})
          </h2>
          <div className="space-y-2">
            {resolvedItems.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="card flex items-center gap-3 px-4 py-2.5 opacity-60"
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    item.status === "confirmed"
                      ? "bg-[rgba(16,185,129,0.12)]"
                      : "bg-[rgba(239,68,68,0.12)]"
                  }`}
                >
                  {item.status === "confirmed" ? (
                    <Check className="h-3.5 w-3.5 text-[var(--color-positive)]" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-[var(--color-negative)]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium">
                    {item.transaction?.merchant || "Transaction"}
                  </p>
                  <p className="text-[0.625rem] text-[var(--text-tertiary)]">
                    {item.resolution} · {timeAgo(item.resolved_at || item.created_at)}
                  </p>
                </div>
                <span
                  className={`badge ${
                    item.status === "confirmed" ? "badge-positive" : "badge-negative"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
