/**
 * Provider interfaces — PRD §64
 * 
 * Business logic must not be tightly coupled to a single provider.
 * All external services are hidden behind these abstractions.
 */

// ─── Financial Source ───────────────────────────────────

export interface SyncResult {
  success: boolean;
  eventsCreated: number;
  eventsUpdated: number;
  errors: SyncError[];
  lastSyncedAt: string;
}

export interface SyncError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface FinancialSource {
  readonly name: string;
  sync(): Promise<SyncResult>;
  healthCheck(): Promise<boolean>;
}

// ─── Market Data Provider ───────────────────────────────

export interface Quote {
  symbol: string;
  price: number;
  currency: string;
  change: number | null;
  changePercent: number | null;
  observedAt: string;
  provider: string;
}

export interface MarketDataProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<Quote | null>;
  getBatchQuotes(symbols: string[]): Promise<Quote[]>;
  healthCheck(): Promise<boolean>;
}

// ─── Blockchain Provider ────────────────────────────────

export interface WalletBalance {
  address: string;
  chain: string;
  assets: TokenBalance[];
  observedAt: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  contractAddress: string | null;
  decimals: number;
}

export interface CryptoTx {
  txHash: string;
  chain: string;
  direction: "incoming" | "outgoing";
  asset: string;
  quantity: string;
  fromAddress: string;
  toAddress: string;
  blockNumber: number;
  timestamp: string;
  fee: string | null;
  status: "confirmed" | "pending" | "failed";
}

export interface BlockchainProvider {
  readonly name: string;
  readonly chain: string;
  getWalletBalance(address: string): Promise<WalletBalance>;
  getTransactions(
    address: string,
    fromBlock?: number
  ): Promise<CryptoTx[]>;
  healthCheck(): Promise<boolean>;
}

// ─── AI Provider ────────────────────────────────────────

export interface ClassificationInput {
  content: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ClassificationResult {
  isFinancial: boolean;
  eventType: string | null;
  direction: "credit" | "debit" | null;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  category: string | null;
  accountHint: string | null;
  transactionType: string | null;
  balanceAfter: number | null;
  reference: string | null;
  occurredAt: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
}

export interface AnalysisInput {
  type: "spending" | "portfolio" | "cashflow" | "general";
  context: Record<string, unknown>;
  question?: string;
}

export interface AnalysisResult {
  title: string;
  body: string;
  insights: Insight[];
  confidence: number;
}

export interface Insight {
  type: "trend" | "anomaly" | "recommendation" | "alert";
  label: "FACT" | "ESTIMATE" | "RECOMMENDATION";
  title: string;
  body: string;
  severity: "info" | "warning" | "alert" | "positive";
  data?: Record<string, unknown>;
}

export interface AIProvider {
  readonly name: string;
  classify(input: ClassificationInput): Promise<ClassificationResult>;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
  answerQuestion(question: string, context: Record<string, unknown>): Promise<string>;
  healthCheck(): Promise<boolean>;
}

// ─── Investment Provider ────────────────────────────────

export interface InvestmentHolding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currency: string;
}

export interface InvestmentProvider {
  readonly name: string;
  getHoldings(): Promise<InvestmentHolding[]>;
  getTransactions(from?: string, to?: string): Promise<unknown[]>;
  healthCheck(): Promise<boolean>;
}

// ─── FX Provider ────────────────────────────────────────

export interface FxQuote {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  observedAt: string;
  provider: string;
}

export interface FxProvider {
  readonly name: string;
  getRate(base: string, quote: string): Promise<FxQuote>;
  getRates(base: string, quotes: string[]): Promise<FxQuote[]>;
  healthCheck(): Promise<boolean>;
}
