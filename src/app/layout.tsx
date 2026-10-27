import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinanceOS — Personal Financial Ledger",
  description:
    "Private, single-user financial operating system. Automatically track net worth, investments, spending, and bills from bank SMS, email, and blockchain wallets.",
  keywords: [
    "personal finance",
    "net worth tracker",
    "investment portfolio",
    "expense tracker",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--bg-primary)] font-[family-name:var(--font-inter)]">
        {children}
      </body>
    </html>
  );
}
