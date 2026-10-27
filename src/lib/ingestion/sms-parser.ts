/**
 * Deterministic SMS parser — PRD §13
 *
 * Extracts financial data from Indian bank/financial SMS messages
 * using regex patterns BEFORE falling back to AI classification.
 * This ensures the system works even when Gemini is unavailable (PRD §65).
 *
 * Supports: SBI, HDFC, ICICI, Axis, SIB, Kotak, PNB, BOB, IndusInd,
 *           UPI, NEFT, IMPS, card transactions, balance alerts, etc.
 */

export interface ParsedSMS {
  isFinancial: boolean;
  direction: "credit" | "debit" | null;
  amount: number | null;
  currency: string;
  accountHint: string | null;
  merchant: string | null;
  balanceAfter: number | null;
  reference: string | null;
  transactionType: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
}

// ─── Amount extraction ────────────────────────────────

const AMOUNT_PATTERNS = [
  // Rs.1,234.56 or Rs 1234.56 or INR 1,234.56
  /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // 1,234.56 Rs or 1234 INR
  /([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR|₹)/i,
  // "debited Rs 2,500" or "credited Rs 1,000"
  /(?:debited|credited|transferred|paid|received|withdrawn|deposited)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "for Rs 2,500" or "of Rs 1,000"
  /(?:for|of|amt|amount)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const amount = parseFloat(cleaned);
      if (!isNaN(amount) && amount > 0) return amount;
    }
  }
  return null;
}

// ─── Direction detection ──────────────────────────────

const DEBIT_KEYWORDS = [
  "debited",
  "debit",
  "spent",
  "paid",
  "withdrawn",
  "purchase",
  "payment",
  "sent",
  "transfer from",
  "auto-debit",
  "auto debit",
  "emi",
  "bill payment",
  "pos",
  "atm withdrawal",
  "neft dr",
  "imps dr",
  "upi dr",
];

const CREDIT_KEYWORDS = [
  "credited",
  "credit",
  "received",
  "deposited",
  "refund",
  "cashback",
  "salary",
  "interest",
  "dividend",
  "transfer to",
  "neft cr",
  "imps cr",
  "upi cr",
];

function detectDirection(text: string): "credit" | "debit" | null {
  const lower = text.toLowerCase();

  // Check for explicit debit keywords
  for (const kw of DEBIT_KEYWORDS) {
    if (lower.includes(kw)) return "debit";
  }

  // Check for explicit credit keywords
  for (const kw of CREDIT_KEYWORDS) {
    if (lower.includes(kw)) return "credit";
  }

  return null;
}

// ─── Account hint extraction ──────────────────────────

const ACCOUNT_PATTERNS = [
  // XX1234 or XXXX1234 or A/c XX1234
  /(?:a\/c|ac|acct|account)\s*(?:no\.?)?\s*[Xx]*(\d{4,})/i,
  // ending 1234 or ending with 1234
  /(?:ending|ends?)\s*(?:with|in)?\s*(\d{4})/i,
  // XX1234 standalone pattern
  /[Xx]{2,}(\d{4})/,
  // card ending 1234
  /card\s*(?:ending|no\.?)?\s*[Xx]*(\d{4})/i,
];

function extractAccountHint(text: string): string | null {
  for (const pattern of ACCOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return `XXXX${match[1]}`;
  }
  return null;
}

// ─── Balance extraction ───────────────────────────────

const BALANCE_PATTERNS = [
  /(?:avl?\s*bal|available\s*bal(?:ance)?|bal(?:ance)?)\s*(?:is|:)?\s*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:avl|available|bal)/i,
];

function extractBalance(text: string): number | null {
  for (const pattern of BALANCE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const balance = parseFloat(cleaned);
      if (!isNaN(balance) && balance >= 0) return balance;
    }
  }
  return null;
}

// ─── Reference extraction ─────────────────────────────

const REFERENCE_PATTERNS = [
  /(?:ref\.?\s*(?:no\.?)?|reference)\s*[:\s]?\s*([A-Z0-9]{6,})/i,
  /(?:utr|rrn|txn\s*id|txn\s*no|transaction\s*(?:id|no))\s*[:\s]?\s*([A-Z0-9]{6,})/i,
  /(?:imps|neft|rtgs)\s*[:\s]?\s*([A-Z0-9]{8,})/i,
];

function extractReference(text: string): string | null {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// ─── Merchant extraction ──────────────────────────────

const MERCHANT_PATTERNS = [
  /(?:at|to|from|@|paid to|sent to|received from)\s+([A-Za-z][A-Za-z0-9\s&'.,-]{2,30}?)(?:\s+(?:on|via|ref|utr|txn|for|avl|bal))/i,
  /(?:at|to|from|@)\s+([A-Za-z][A-Za-z0-9\s&'.,-]{2,25})/i,
  /VPA\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i,
];

function extractMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const merchant = match[1].trim();
      // Filter out common non-merchant matches
      const skipWords = ["your", "the", "bank", "account", "card", "upi", "neft", "imps"];
      if (skipWords.includes(merchant.toLowerCase())) continue;
      return merchant;
    }
  }
  return null;
}

// ─── Transaction type detection ───────────────────────

function detectTransactionType(text: string): string | null {
  const lower = text.toLowerCase();

  if (lower.includes("upi")) return "upi";
  if (lower.includes("neft")) return "neft";
  if (lower.includes("imps")) return "imps";
  if (lower.includes("rtgs")) return "rtgs";
  if (lower.includes("pos") || lower.includes("card purchase")) return "card_purchase";
  if (lower.includes("atm")) return "atm_withdrawal";
  if (lower.includes("emi")) return "emi";
  if (lower.includes("auto-debit") || lower.includes("auto debit")) return "auto_debit";
  if (lower.includes("salary")) return "salary";
  if (lower.includes("interest")) return "interest";
  if (lower.includes("dividend")) return "dividend";
  if (lower.includes("refund") || lower.includes("cashback")) return "refund";
  if (lower.includes("bill") || lower.includes("recharge")) return "bill_payment";
  if (lower.includes("cheque") || lower.includes("check")) return "cheque";

  return null;
}

// ─── Financial SMS detection ──────────────────────────

const FINANCIAL_KEYWORDS = [
  "debited",
  "credited",
  "withdrawn",
  "deposited",
  "transferred",
  "transaction",
  "payment",
  "balance",
  "spent",
  "received",
  "emi",
  "upi",
  "neft",
  "imps",
  "rtgs",
  "atm",
  "pos",
  "salary",
  "refund",
  "cashback",
  "otp", // OTPs are financial but we don't extract them
];

const NON_FINANCIAL_PATTERNS = [
  /otp\s*(?:is|:)\s*\d{4,8}/i, // OTP messages
  /one\s*time\s*password/i,
  /verification\s*code/i,
];

function isFinancialSMS(text: string): boolean {
  const lower = text.toLowerCase();

  // Exclude OTPs and verification codes
  for (const pattern of NON_FINANCIAL_PATTERNS) {
    if (pattern.test(text)) return false;
  }

  // Check for financial keywords
  for (const kw of FINANCIAL_KEYWORDS) {
    if (lower.includes(kw)) {
      // Also check for an amount — keyword alone isn't enough
      if (extractAmount(text) !== null) return true;
      // Balance-only messages are also financial
      if (extractBalance(text) !== null) return true;
    }
  }

  return false;
}

// ─── Main parser ──────────────────────────────────────

export function parseSMS(body: string): ParsedSMS {
  const text = body.trim();

  // Step 1: Is this a financial SMS?
  if (!isFinancialSMS(text)) {
    return {
      isFinancial: false,
      direction: null,
      amount: null,
      currency: "INR",
      accountHint: null,
      merchant: null,
      balanceAfter: null,
      reference: null,
      transactionType: null,
      confidence: 0.95,
      needsReview: false,
      reviewReason: null,
    };
  }

  // Step 2: Extract all fields deterministically
  const amount = extractAmount(text);
  const direction = detectDirection(text);
  const accountHint = extractAccountHint(text);
  const balanceAfter = extractBalance(text);
  const reference = extractReference(text);
  const merchant = extractMerchant(text);
  const transactionType = detectTransactionType(text);

  // Step 3: Calculate confidence
  let confidence = 0.5;
  if (amount !== null) confidence += 0.15;
  if (direction !== null) confidence += 0.15;
  if (accountHint !== null) confidence += 0.05;
  if (reference !== null) confidence += 0.05;
  if (merchant !== null) confidence += 0.05;
  if (transactionType !== null) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  // Step 4: Determine if review is needed
  let needsReview = false;
  let reviewReason: string | null = null;

  if (amount === null) {
    needsReview = true;
    reviewReason = "Could not extract transaction amount";
  } else if (direction === null) {
    needsReview = true;
    reviewReason = "Could not determine debit/credit direction";
  } else if (confidence < 0.7) {
    needsReview = true;
    reviewReason = "Low classification confidence";
  }

  return {
    isFinancial: true,
    direction,
    amount,
    currency: "INR",
    accountHint,
    merchant,
    balanceAfter,
    reference,
    transactionType,
    confidence,
    needsReview,
    reviewReason,
  };
}
