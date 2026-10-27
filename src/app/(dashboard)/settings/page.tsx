import { createClient } from "@/lib/supabase/server";
import { Settings as SettingsIcon, Smartphone, Mail, AlertCircle, Check, Link2, Link2Off, RefreshCw } from "lucide-react";
import { MacroDroidSetup } from "./macrodroid-setup";
import { GmailSetup } from "./gmail-setup";

export const metadata = {
  title: "Settings — FinanceOS",
  description: "Integrations, preferences, and security",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  let gmailAccounts: any[] = [];
  if (user) {
    const { data } = await supabase
      .from("gmail_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);
    
    if (data) gmailAccounts = data;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Integrations, preferences, and security
        </p>
      </div>

      {/* Gmail Integration — Chunk 3 */}
      <div className="card overflow-hidden border-[var(--accent-primary)]/20">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.12)]">
            <Mail className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Gmail Accounts</h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              Connect up to 2 Gmail accounts for automatic receipt and transaction tracking
            </p>
          </div>
          <span className="badge bg-blue-500/10 text-blue-500">Active</span>
        </div>
        <div className="p-5">
          <GmailSetup accounts={gmailAccounts} />
        </div>
      </div>

      {/* MacroDroid SMS Integration — Active */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(16,185,129,0.12)]">
            <Smartphone className="h-4 w-4 text-[var(--color-positive)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold">MacroDroid SMS</h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              Auto-intercept bank SMS from your Android device
            </p>
          </div>
          <span className="badge badge-positive">Active</span>
        </div>
        <div className="p-5">
          <MacroDroidSetup />
        </div>
      </div>

      {/* Future integrations */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          {
            title: "Broker Connections",
            desc: "Connect Zerodha, Groww, or other brokers",
            status: "Chunk 4",
            icon: "📈",
          },
          {
            title: "Blockchain Wallets",
            desc: "Add Trust Wallet or other crypto addresses",
            status: "Chunk 5",
            icon: "🔗",
          },
          {
            title: "AI Provider",
            desc: "Configure Gemini for financial analysis",
            status: "Chunk 7",
            icon: "✨",
          },
          {
            title: "Financial Goals",
            desc: "Set and track your financial goals",
            status: "Chunk 7",
            icon: "🎯",
          },
          {
            title: "Security & Export",
            desc: "Sessions, data export, and audit logs",
            status: "Chunk 8",
            icon: "🔒",
          },
        ].map((item) => (
          <div key={item.title} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg">{item.icon}</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {item.desc}
                </p>
              </div>
              <span className="badge badge-neutral">{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
