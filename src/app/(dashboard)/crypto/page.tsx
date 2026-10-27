import { Coins } from "lucide-react";

export const metadata = {
  title: "Crypto — FinanceOS",
  description: "Track your crypto wallets and holdings",
};

export default function CryptoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crypto</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Wallet tracking and blockchain activity
        </p>
      </div>
      <div className="card flex flex-col items-center py-20 text-center">
        <Coins className="mb-3 h-12 w-12 text-[var(--text-tertiary)]" />
        <p className="text-lg font-semibold text-[var(--text-secondary)]">
          Coming in Chunk 5
        </p>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Trust Wallet address monitoring, on-chain transactions, and token valuations
        </p>
      </div>
    </div>
  );
}
