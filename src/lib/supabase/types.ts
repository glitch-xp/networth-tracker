/**
 * Database types for Supabase.
 * 
 * These will be auto-generated from the schema once connected.
 * For now, manual type definitions matching the PRD §25 schema.
 */

// Account types from PRD §25
export type AccountType =
  | "bank"
  | "credit_card"
  | "broker"
  | "mutual_fund"
  | "crypto_wallet"
  | "cash"
  | "loan"
  | "other";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "investment"
  | "refund"
  | "fee"
  | "tax"
  | "dividend"
  | "interest"
  | "other";

export type TransactionDirection = "credit" | "debit";

export type TransactionStatus =
  | "confirmed"
  | "pending"
  | "voided"
  | "needs_review";

export type SourceType =
  | "sms"
  | "gmail"
  | "api"
  | "blockchain"
  | "manual"
  | "csv";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "needs_review"
  | "failed"
  | "ignored";

export type InvestmentTransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "sip"
  | "mf_purchase"
  | "mf_redemption"
  | "stock_split"
  | "bonus"
  | "corporate_action"
  | "fee"
  | "tax"
  | "deposit"
  | "withdrawal";

export type AssetType =
  | "indian_stock"
  | "us_stock"
  | "mutual_fund"
  | "etf"
  | "crypto"
  | "bond"
  | "fd"
  | "other";

export type BillFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly";

export type BillStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled";

export type InsightSeverity = "info" | "warning" | "alert" | "positive";

export type ReviewStatus = "pending" | "confirmed" | "rejected" | "merged";

export type ChainType =
  | "ethereum"
  | "bsc"
  | "polygon"
  | "solana"
  | "arbitrum"
  | "optimism"
  | "avalanche"
  | "other";

// Row types matching database schema
export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: AccountType;
  currency: string;
  masked_identifier: string | null;
  is_asset: boolean;
  is_liability: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  transaction_type: TransactionType;
  direction: TransactionDirection;
  amount: string; // numeric stored as string
  currency: string;
  merchant: string | null;
  description: string | null;
  category: string | null;
  occurred_at: string;
  reference: string | null;
  status: TransactionStatus;
  confidence: number | null;
  needs_review: boolean;
  review_reason: string | null;
  is_transfer: boolean;
  transfer_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionSource {
  id: string;
  transaction_id: string;
  source_type: SourceType;
  source_external_id: string | null;
  source_hash: string | null;
  source_metadata: Record<string, unknown> | null;
  received_at: string;
}

export interface IngestionEvent {
  id: string;
  user_id: string;
  source_type: SourceType;
  external_id: string | null;
  payload_hash: string | null;
  received_at: string;
  processing_status: ProcessingStatus;
  error_code: string | null;
  processed_at: string | null;
}

export interface BalanceSnapshot {
  id: string;
  account_id: string;
  balance: string;
  currency: string;
  source: SourceType;
  observed_at: string;
  confidence: number | null;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  exchange: string | null;
  isin: string | null;
  currency: string;
  market_data_symbol: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: string;
  account_id: string;
  instrument_id: string;
  quantity: string;
  average_cost: string;
  cost_basis: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentTransaction {
  id: string;
  account_id: string;
  instrument_id: string;
  type: InvestmentTransactionType;
  quantity: string;
  price: string;
  fees: string;
  taxes: string;
  currency: string;
  occurred_at: string;
  source_transaction_id: string | null;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  merchant: string | null;
  amount: string;
  min_amount: string | null;
  max_amount: string | null;
  currency: string;
  frequency: BillFrequency;
  next_due_at: string | null;
  account_id: string | null;
  category: string | null;
  status: BillStatus;
  confidence: number | null;
  source_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  chain: ChainType;
  address: string;
  last_scanned_block: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface CryptoTransaction {
  id: string;
  wallet_id: string;
  tx_hash: string;
  direction: TransactionDirection;
  asset: string;
  quantity: string;
  fiat_value: string | null;
  currency: string;
  from_address: string | null;
  to_address: string | null;
  occurred_at: string;
  status: string;
}

export interface MarketPrice {
  id: string;
  instrument_id: string;
  price: string;
  currency: string;
  provider: string;
  observed_at: string;
}

export interface FxRate {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
  provider: string;
  observed_at: string;
}

export interface FinancialSnapshot {
  id: string;
  user_id: string;
  net_worth: string;
  assets: string;
  liabilities: string;
  cash: string;
  investments: string;
  crypto: string;
  recorded_at: string;
}

export interface AiInsight {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  data_context: Record<string, unknown> | null;
  created_at: string;
  expires_at: string | null;
}

export interface ReviewQueueItem {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  confidence: number | null;
  status: ReviewStatus;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

// Supabase Database type
export interface Database {
  public: {
    Tables: {
      financial_accounts: {
        Row: FinancialAccount;
        Insert: Omit<FinancialAccount, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<FinancialAccount, "id" | "created_at">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Transaction, "id" | "created_at">>;
      };
      transaction_sources: {
        Row: TransactionSource;
        Insert: Omit<TransactionSource, "id">;
        Update: Partial<Omit<TransactionSource, "id">>;
      };
      ingestion_events: {
        Row: IngestionEvent;
        Insert: Omit<IngestionEvent, "id">;
        Update: Partial<Omit<IngestionEvent, "id">>;
      };
      balance_snapshots: {
        Row: BalanceSnapshot;
        Insert: Omit<BalanceSnapshot, "id">;
        Update: Partial<Omit<BalanceSnapshot, "id">>;
      };
      instruments: {
        Row: Instrument;
        Insert: Omit<Instrument, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Instrument, "id" | "created_at">>;
      };
      holdings: {
        Row: Holding;
        Insert: Omit<Holding, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Holding, "id" | "created_at">>;
      };
      investment_transactions: {
        Row: InvestmentTransaction;
        Insert: Omit<InvestmentTransaction, "id">;
        Update: Partial<Omit<InvestmentTransaction, "id">>;
      };
      bills: {
        Row: Bill;
        Insert: Omit<Bill, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Bill, "id" | "created_at">>;
      };
      wallets: {
        Row: Wallet;
        Insert: Omit<Wallet, "id" | "created_at">;
        Update: Partial<Omit<Wallet, "id" | "created_at">>;
      };
      crypto_transactions: {
        Row: CryptoTransaction;
        Insert: Omit<CryptoTransaction, "id">;
        Update: Partial<Omit<CryptoTransaction, "id">>;
      };
      market_prices: {
        Row: MarketPrice;
        Insert: Omit<MarketPrice, "id">;
        Update: Partial<Omit<MarketPrice, "id">>;
      };
      fx_rates: {
        Row: FxRate;
        Insert: Omit<FxRate, "id">;
        Update: Partial<Omit<FxRate, "id">>;
      };
      financial_snapshots: {
        Row: FinancialSnapshot;
        Insert: Omit<FinancialSnapshot, "id">;
        Update: Partial<Omit<FinancialSnapshot, "id">>;
      };
      ai_insights: {
        Row: AiInsight;
        Insert: Omit<AiInsight, "id" | "created_at">;
        Update: Partial<Omit<AiInsight, "id" | "created_at">>;
      };
      review_queue: {
        Row: ReviewQueueItem;
        Insert: Omit<ReviewQueueItem, "id" | "created_at">;
        Update: Partial<Omit<ReviewQueueItem, "id" | "created_at">>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: never; // Audit logs are immutable
      };
      financial_goals: {
        Row: FinancialGoal;
        Insert: Omit<FinancialGoal, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<FinancialGoal, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_type: AccountType;
      transaction_type: TransactionType;
      transaction_direction: TransactionDirection;
      transaction_status: TransactionStatus;
      source_type: SourceType;
      processing_status: ProcessingStatus;
      investment_transaction_type: InvestmentTransactionType;
      asset_type: AssetType;
      bill_frequency: BillFrequency;
      bill_status: BillStatus;
      insight_severity: InsightSeverity;
      review_status: ReviewStatus;
      chain_type: ChainType;
    };
  };
}
