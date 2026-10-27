"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowRightLeft,
  TrendingUp,
  Coins,
  Receipt,
  BarChart3,
  Sparkles,
  AlertCircle,
  Building2,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/crypto", label: "Crypto", icon: Coins },
  { href: "/bills", label: "Bills", icon: Receipt },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/review", label: "Review", icon: AlertCircle },
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]">
          <Wallet className="h-4.5 w-4.5 text-[var(--text-inverse)]" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">FinanceOS</h1>
          <p className="text-[0.625rem] text-[var(--text-tertiary)]">Personal Ledger</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-item", isActive(item.href) && "active")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.href === "/review" && (
                <span className="ml-auto flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--color-warning)] px-1 text-[0.625rem] font-bold text-[var(--text-inverse)]">
                  0
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-[var(--border-subtle)] px-3 py-3">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-[var(--color-negative)] hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
