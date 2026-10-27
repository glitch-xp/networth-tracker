import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian currency (INR).
 * Uses numeric type compatible with Postgres numeric columns.
 */
export function formatINR(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";

  const isNegative = num < 0;
  const abs = Math.abs(num);
  const [intPart, decPart] = abs.toFixed(2).split(".");

  // Indian number system: last 3 digits, then groups of 2
  let result = "";
  const digits = intPart;
  if (digits.length <= 3) {
    result = digits;
  } else {
    result = digits.slice(-3);
    let remaining = digits.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + "," + result;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      result = remaining + "," + result;
    }
  }

  return `${isNegative ? "-" : ""}₹${result}.${decPart}`;
}

/**
 * Format a number as compact (e.g., ₹1.2L, ₹3.5Cr)
 */
export function formatINRCompact(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹0";

  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}₹${abs.toFixed(0)}`;
}

/**
 * Format a relative time string (e.g., "2 minutes ago")
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
