-- Personal Financial OS — Initial Schema Migration
-- PRD §25: Full database schema with RLS, audit triggers, and all tables
-- Money columns use numeric (never float) per PRD §26

-- ════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════

CREATE TYPE account_type AS ENUM (
  'bank', 'credit_card', 'broker', 'mutual_fund',
  'crypto_wallet', 'cash', 'loan', 'other'
);

CREATE TYPE transaction_type AS ENUM (
  'income', 'expense', 'transfer', 'investment',
  'refund', 'fee', 'tax', 'dividend', 'interest', 'other'
);

CREATE TYPE transaction_direction AS ENUM ('credit', 'debit');

CREATE TYPE transaction_status AS ENUM (
  'confirmed', 'pending', 'voided', 'needs_review'
);

CREATE TYPE source_type AS ENUM (
  'sms', 'gmail', 'api', 'blockchain', 'manual', 'csv'
);

CREATE TYPE processing_status AS ENUM (
  'pending', 'processing', 'processed',
  'needs_review', 'failed', 'ignored'
);

CREATE TYPE investment_transaction_type AS ENUM (
  'buy', 'sell', 'dividend', 'sip', 'mf_purchase', 'mf_redemption',
  'stock_split', 'bonus', 'corporate_action', 'fee', 'tax',
  'deposit', 'withdrawal'
);

CREATE TYPE asset_type AS ENUM (
  'indian_stock', 'us_stock', 'mutual_fund', 'etf',
  'crypto', 'bond', 'fd', 'other'
);

CREATE TYPE bill_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly',
  'quarterly', 'half_yearly', 'yearly'
);

CREATE TYPE bill_status AS ENUM (
  'active', 'paused', 'completed', 'cancelled'
);

CREATE TYPE insight_severity AS ENUM (
  'info', 'warning', 'alert', 'positive'
);

CREATE TYPE review_status AS ENUM (
  'pending', 'confirmed', 'rejected', 'merged'
);

CREATE TYPE chain_type AS ENUM (
  'ethereum', 'bsc', 'polygon', 'solana',
  'arbitrum', 'optimism', 'avalanche', 'other'
);


-- ════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════

-- financial_accounts
CREATE TABLE financial_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  institution text,
  account_type account_type NOT NULL DEFAULT 'bank',
  currency    text NOT NULL DEFAULT 'INR',
  masked_identifier text,
  is_asset    boolean NOT NULL DEFAULT true,
  is_liability boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_accounts_user ON financial_accounts(user_id);


-- transactions
CREATE TABLE transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  transaction_type transaction_type NOT NULL DEFAULT 'expense',
  direction       transaction_direction NOT NULL DEFAULT 'debit',
  amount          numeric NOT NULL CHECK (amount >= 0),
  currency        text NOT NULL DEFAULT 'INR',
  merchant        text,
  description     text,
  category        text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  reference       text,
  status          transaction_status NOT NULL DEFAULT 'confirmed',
  confidence      numeric CHECK (confidence >= 0 AND confidence <= 1),
  needs_review    boolean NOT NULL DEFAULT false,
  review_reason   text,
  is_transfer     boolean NOT NULL DEFAULT false,
  transfer_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_occurred ON transactions(occurred_at DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_review ON transactions(needs_review) WHERE needs_review = true;


-- transaction_sources (links ingestion sources to canonical transaction, PRD §8)
CREATE TABLE transaction_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  source_type       source_type NOT NULL,
  source_external_id text,
  source_hash       text,
  source_metadata   jsonb,
  received_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_sources_transaction ON transaction_sources(transaction_id);
CREATE INDEX idx_tx_sources_external ON transaction_sources(source_type, source_external_id);
CREATE UNIQUE INDEX idx_tx_sources_unique_source ON transaction_sources(source_type, source_external_id) 
  WHERE source_external_id IS NOT NULL;


-- ingestion_events
CREATE TABLE ingestion_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type      source_type NOT NULL,
  external_id      text,
  payload_hash     text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  processing_status processing_status NOT NULL DEFAULT 'pending',
  error_code       text,
  processed_at     timestamptz
);

CREATE INDEX idx_ingestion_user ON ingestion_events(user_id);
CREATE INDEX idx_ingestion_status ON ingestion_events(processing_status);
CREATE UNIQUE INDEX idx_ingestion_dedup ON ingestion_events(source_type, external_id)
  WHERE external_id IS NOT NULL;


-- balance_snapshots
CREATE TABLE balance_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  balance     numeric NOT NULL,
  currency    text NOT NULL DEFAULT 'INR',
  source      source_type NOT NULL DEFAULT 'manual',
  observed_at timestamptz NOT NULL DEFAULT now(),
  confidence  numeric CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_balance_account ON balance_snapshots(account_id, observed_at DESC);


-- instruments
CREATE TABLE instruments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol            text NOT NULL,
  name              text NOT NULL,
  asset_type        asset_type NOT NULL,
  exchange          text,
  isin              text,
  currency          text NOT NULL DEFAULT 'INR',
  market_data_symbol text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_instruments_symbol ON instruments(symbol, exchange) 
  WHERE exchange IS NOT NULL;
CREATE INDEX idx_instruments_isin ON instruments(isin) WHERE isin IS NOT NULL;


-- holdings
CREATE TABLE holdings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  instrument_id  uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  quantity       numeric NOT NULL DEFAULT 0,
  average_cost   numeric NOT NULL DEFAULT 0,
  cost_basis     numeric NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, instrument_id)
);

CREATE INDEX idx_holdings_account ON holdings(account_id);


-- investment_transactions
CREATE TABLE investment_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  instrument_id         uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  type                  investment_transaction_type NOT NULL,
  quantity              numeric NOT NULL DEFAULT 0,
  price                 numeric NOT NULL DEFAULT 0,
  fees                  numeric NOT NULL DEFAULT 0,
  taxes                 numeric NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'INR',
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  source_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE INDEX idx_inv_tx_account ON investment_transactions(account_id);
CREATE INDEX idx_inv_tx_instrument ON investment_transactions(instrument_id);


-- bills
CREATE TABLE bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  merchant      text,
  amount        numeric NOT NULL DEFAULT 0,
  min_amount    numeric,
  max_amount    numeric,
  currency      text NOT NULL DEFAULT 'INR',
  frequency     bill_frequency NOT NULL DEFAULT 'monthly',
  next_due_at   timestamptz,
  account_id    uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  category      text,
  status        bill_status NOT NULL DEFAULT 'active',
  confidence    numeric CHECK (confidence >= 0 AND confidence <= 1),
  source_event_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bills_user ON bills(user_id);
CREATE INDEX idx_bills_next_due ON bills(next_due_at) WHERE status = 'active';


-- wallets (Trust Wallet / crypto)
CREATE TABLE wallets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  chain             chain_type NOT NULL,
  address           text NOT NULL,
  last_scanned_block text,
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, address)
);

CREATE INDEX idx_wallets_user ON wallets(user_id);


-- crypto_transactions
CREATE TABLE crypto_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  tx_hash       text NOT NULL,
  direction     transaction_direction NOT NULL,
  asset         text NOT NULL,
  quantity      numeric NOT NULL DEFAULT 0,
  fiat_value    numeric,
  currency      text NOT NULL DEFAULT 'INR',
  from_address  text,
  to_address    text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'confirmed'
);

CREATE INDEX idx_crypto_tx_wallet ON crypto_transactions(wallet_id);
CREATE UNIQUE INDEX idx_crypto_tx_dedup ON crypto_transactions(wallet_id, tx_hash);


-- market_prices
CREATE TABLE market_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  price         numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'INR',
  provider      text NOT NULL,
  observed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prices_instrument ON market_prices(instrument_id, observed_at DESC);


-- fx_rates
CREATE TABLE fx_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency  text NOT NULL,
  quote_currency text NOT NULL,
  rate           numeric NOT NULL,
  provider       text NOT NULL DEFAULT 'frankfurter',
  observed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fx_pair ON fx_rates(base_currency, quote_currency, observed_at DESC);


-- financial_snapshots (daily net worth snapshots)
CREATE TABLE financial_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  net_worth   numeric NOT NULL DEFAULT 0,
  assets      numeric NOT NULL DEFAULT 0,
  liabilities numeric NOT NULL DEFAULT 0,
  cash        numeric NOT NULL DEFAULT 0,
  investments numeric NOT NULL DEFAULT 0,
  crypto      numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_user ON financial_snapshots(user_id, recorded_at DESC);


-- ai_insights
CREATE TABLE ai_insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  severity     insight_severity NOT NULL DEFAULT 'info',
  data_context jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

CREATE INDEX idx_insights_user ON ai_insights(user_id, created_at DESC);


-- review_queue
CREATE TABLE review_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  reason      text NOT NULL,
  confidence  numeric CHECK (confidence >= 0 AND confidence <= 1),
  status      review_status NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution  text
);

CREATE INDEX idx_review_user ON review_queue(user_id);
CREATE INDEX idx_review_pending ON review_queue(status) WHERE status = 'pending';


-- audit_logs (immutable — PRD §41)
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor       text NOT NULL DEFAULT 'system',
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);


-- financial_goals
CREATE TABLE financial_goals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  target_amount  numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  target_date    date,
  priority       integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_goals_user ON financial_goals(user_id);


-- ════════════════════════════════════════════════
-- updated_at TRIGGER FUNCTION
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_financial_accounts_updated
  BEFORE UPDATE ON financial_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_instruments_updated
  BEFORE UPDATE ON instruments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_holdings_updated
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bills_updated
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_goals_updated
  BEFORE UPDATE ON financial_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════
-- AUDIT LOG TRIGGER (PRD §41)
-- ════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, actor, action, entity_type, entity_id, after_data)
    VALUES (NEW.user_id, 'system', 'create', 'transaction', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, actor, action, entity_type, entity_id, before_data, after_data)
    VALUES (NEW.user_id, 'system', 'update', 'transaction', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, actor, action, entity_type, entity_id, before_data)
    VALUES (OLD.user_id, 'system', 'delete', 'transaction', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE TRIGGER trg_transactions_audit
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION audit_transaction_changes();


-- ════════════════════════════════════════════════
-- ROW-LEVEL SECURITY (PRD §38)
-- ════════════════════════════════════════════════
-- Every user-owned table: auth.uid() = user_id
-- Using (select auth.uid()) pattern for performance

ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their accounts" ON financial_accounts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their transactions" ON transactions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE transaction_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their tx sources" ON transaction_sources
  FOR ALL TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE user_id = (select auth.uid())
    )
  );

ALTER TABLE ingestion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their ingestion events" ON ingestion_events
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE balance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their balance snapshots" ON balance_snapshots
  FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT id FROM financial_accounts WHERE user_id = (select auth.uid())
    )
  );

ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
-- Instruments are shared reference data, readable by all authenticated users
CREATE POLICY "Authenticated users can read instruments" ON instruments
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert instruments" ON instruments
  FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their holdings" ON holdings
  FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT id FROM financial_accounts WHERE user_id = (select auth.uid())
    )
  );

ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their investment tx" ON investment_transactions
  FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT id FROM financial_accounts WHERE user_id = (select auth.uid())
    )
  );

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their bills" ON bills
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their wallets" ON wallets
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access their crypto tx" ON crypto_transactions
  FOR ALL TO authenticated
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = (select auth.uid())
    )
  );

ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
-- Market prices are shared reference data
CREATE POLICY "Authenticated users can read prices" ON market_prices
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fx rates" ON fx_rates
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their snapshots" ON financial_snapshots
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their insights" ON ai_insights
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their review items" ON review_queue
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Audit logs: user can read their own, but cannot update or delete
CREATE POLICY "Users can read their audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
-- No INSERT/UPDATE/DELETE policies for authenticated role — only system/triggers can write

ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their goals" ON financial_goals
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
