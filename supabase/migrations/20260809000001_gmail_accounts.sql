-- Gmail Accounts table — PRD §10
-- Stores connected Gmail accounts with OAuth tokens and sync state

CREATE TABLE gmail_accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  history_id       text,
  watch_expiration timestamptz,
  last_sync_at     timestamptz,
  sync_status      text NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message    text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gmail_accounts_user ON gmail_accounts(user_id);
CREATE UNIQUE INDEX idx_gmail_accounts_email ON gmail_accounts(user_id, email);

-- Max 2 Gmail accounts per user
CREATE OR REPLACE FUNCTION check_gmail_account_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM gmail_accounts WHERE user_id = NEW.user_id AND is_active = true) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 Gmail accounts allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gmail_account_limit
  BEFORE INSERT ON gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION check_gmail_account_limit();

CREATE TRIGGER trg_gmail_accounts_updated
  BEFORE UPDATE ON gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: users can only access their own Gmail accounts
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their gmail accounts" ON gmail_accounts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
