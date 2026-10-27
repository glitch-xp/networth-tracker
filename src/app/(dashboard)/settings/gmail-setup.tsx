"use client";

import { useState } from "react";
import { Link2, Link2Off, RefreshCw, AlertCircle, Loader2 } from "lucide-react";

export function GmailSetup({ accounts }: { accounts: any[] }) {
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/gmail/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate connection");
        setConnecting(false);
      }
    } catch (err) {
      alert("Failed to connect");
      setConnecting(false);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (data.success) {
        // Simple reload to refresh UI for now
        window.location.reload();
      } else {
        alert(data.error || "Sync failed");
      }
    } catch (err) {
      alert("Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            No Gmail accounts connected yet.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn btn-primary"
          >
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Connect Gmail Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3"
            >
              <div>
                <p className="text-sm font-medium">{account.email}</p>
                <div className="mt-1 flex items-center gap-2 text-[0.625rem] text-[var(--text-tertiary)]">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      account.sync_status === "error"
                        ? "text-[var(--color-negative)]"
                        : "text-[var(--color-positive)]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {account.sync_status === "syncing" ? "Syncing..." : account.sync_status === "error" ? "Sync Error" : "Connected"}
                  </span>
                  <span>•</span>
                  <span>
                    Last sync:{" "}
                    {account.last_sync_at
                      ? new Date(account.last_sync_at).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                {account.error_message && (
                  <p className="mt-1 text-[0.625rem] text-[var(--color-negative)]">
                    <AlertCircle className="inline mr-1 h-3 w-3" />
                    {account.error_message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(account.id)}
                  disabled={syncing === account.id || account.sync_status === "syncing"}
                  className="btn btn-ghost text-xs"
                >
                  <RefreshCw
                    className={`mr-1.5 h-3.5 w-3.5 ${
                      syncing === account.id || account.sync_status === "syncing"
                        ? "animate-spin"
                        : ""
                    }`}
                  />
                  Sync Now
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement disconnect
                    alert("Disconnect not fully implemented in UI yet.");
                  }}
                  className="btn btn-ghost text-xs text-[var(--color-negative)]"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {accounts.length < 2 && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn btn-secondary text-xs"
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-3.5 w-3.5" />
                )}
                Connect Another Account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
