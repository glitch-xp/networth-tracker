/**
 * Email Parser — PRD §11
 *
 * Extracts financial data from email subject + body.
 * Works as a deterministic pre-parser before AI classification,
 * same pattern as sms-parser.ts.
 */

export interface ParsedEmail {
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

// ─── Financial sender detection ───────────────────────

const FINANCIAL_SENDER_PATTERNS = [
  /alerts?@/i,
  /noreply@.*bank/i,
  /transaction/i,
  /statement/i,
  /payment/i,
  /@.*bank\./i,
  /@hdfcbank\./i,
  /@icicibank\./i,
  /@sbi\./i,
  /@axisbank\./i,
  /@kotak\./i,
  /@paytm\./i,
  /@phonepe\./i,
  /@gpay\./i,
  /@paypal\./i,
  /@zerodha\./i,
  /@groww\./i,
  /@kuvera\./i,
  /@cams.*\.com/i,
  /@.*insurance/i,
  /@.*mutual/i,
  /razorpay/i,
  /stripe/i,
  /amazon.*pay/i,
];

const FINANCIAL_SUBJECT_KEYWORDS = [
  "transaction",
  "payment",
  "credited",
  "debited",
  "receipt",
  "invoice",
  "statement",
  "salary",
  "dividend",
  "refund",
  "bill",
  "subscription",
  "emi",
  "insurance",
  "premium",
  "mutual fund",
  "purchase",
  "order confirmation",
  "withdrawal",
  "deposit",
  "transfer",
  "paypal",
];

// ─── Amount extraction from email ─────────────────────

const EMAIL_AMOUNT_PATTERNS = [
  /(?:Rs\.?|INR|₹|USD|\$|€|EUR)\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:amount|total|paid|received|credited|debited)\s*[:=]?\s*(?:Rs\.?|INR|₹|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  /(?:for|of)\s+(?:Rs\.?|INR|₹|USD|\$)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
];

function extractAmountFromEmail(text: string): { amount: number | null; currency: string } {
  let currency = "INR";

  // Detect currency
  if (/USD|\$/i.test(text)) currency = "USD";
  else if (/EUR|€/i.test(text)) currency = "EUR";
  else if (/GBP|£/i.test(text)) currency = "GBP";

  for (const pattern of EMAIL_AMOUNT_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const match = pattern.exec(text);
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const amount = parseFloat(cleaned);
      if (!isNaN(amount) && amount > 0) return { amount, currency };
    }
  }

  return { amount: null, currency };
}

// ─── Direction detection ──────────────────────────────

const DEBIT_EMAIL_KEYWORDS = [
  "debited",
  "payment made",
  "paid",
  "purchase",
  "order confirmed",
  "subscription charged",
  "emi deducted",
  "premium debited",
  "withdrawal",
  "sent",
  "auto-debit",
];

const CREDIT_EMAIL_KEYWORDS = [
  "credited",
  "received",
  "refund",
  "cashback",
  "salary",
  "dividend",
  "interest",
  "deposit",
  "reimbursement",
  "payout",
];

function detectEmailDirection(text: string): "credit" | "debit" | null {
  const lower = text.toLowerCase();
  for (const kw of DEBIT_EMAIL_KEYWORDS) {
    if (lower.includes(kw)) return "debit";
  }
  for (const kw of CREDIT_EMAIL_KEYWORDS) {
    if (lower.includes(kw)) return "credit";
  }
  return null;
}

// ─── Account extraction ───────────────────────────────

function extractEmailAccountHint(text: string): string | null {
  const patterns = [
    /(?:a\/c|ac|account|card)\s*(?:no\.?|ending|ends?)?\s*[Xx]*(\d{4})/i,
    /[Xx]{2,}(\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return `XXXX${match[1]}`;
  }
  return null;
}

// ─── Reference extraction ─────────────────────────────

function extractEmailReference(text: string): string | null {
  const patterns = [
    /(?:ref\.?\s*(?:no\.?)?|reference|txn\s*(?:id|no)|transaction\s*(?:id|no)|order\s*(?:id|no)|utr|rrn)\s*[:\s#]?\s*([A-Z0-9-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// ─── Transaction type ─────────────────────────────────

function detectEmailTransactionType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("salary") || lower.includes("payroll")) return "salary";
  if (lower.includes("dividend")) return "dividend";
  if (lower.includes("insurance") || lower.includes("premium")) return "insurance";
  if (lower.includes("subscription")) return "subscription";
  if (lower.includes("emi")) return "emi";
  if (lower.includes("mutual fund") || lower.includes("sip")) return "mutual_fund";
  if (lower.includes("refund") || lower.includes("cashback")) return "refund";
  if (lower.includes("paypal")) return "paypal";
  if (lower.includes("upi")) return "upi";
  if (lower.includes("neft")) return "neft";
  if (lower.includes("imps")) return "imps";
  if (lower.includes("bill") || lower.includes("recharge")) return "bill_payment";
  if (lower.includes("investment") || lower.includes("stock") || lower.includes("share")) return "investment";
  return null;
}

// ─── Merchant extraction ──────────────────────────────

function extractEmailMerchant(text: string, from: string): string | null {
  // Try to extract from email sender name
  const senderMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (senderMatch?.[1]) {
    const sender = senderMatch[1].trim();
    // Skip generic senders
    const genericSenders = ["alerts", "noreply", "no-reply", "transactions", "info", "support"];
    if (!genericSenders.some((g) => sender.toLowerCase().includes(g))) {
      return sender;
    }
  }

  // Try to extract from body
  const merchantPatterns = [
    /(?:merchant|payee|paid to|from|at)\s*[:=]?\s*([A-Za-z][A-Za-z0-9\s&'.,-]{2,30})/i,
    /(?:order from|purchase at|subscription to)\s+([A-Za-z][A-Za-z0-9\s&'.,-]{2,25})/i,
  ];
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

// ─── Main parser ──────────────────────────────────────

export function parseEmail(input: {
  from: string;
  subject: string;
  body: string;
  snippet?: string;
}): ParsedEmail {
  const fullText = `${input.subject}\n${input.body}`;

  // Step 1: Is this from a financial sender?
  const isFinancialSender = FINANCIAL_SENDER_PATTERNS.some((p) =>
    p.test(input.from)
  );
  const isFinancialSubject = FINANCIAL_SUBJECT_KEYWORDS.some((kw) =>
    input.subject.toLowerCase().includes(kw)
  );

  if (!isFinancialSender && !isFinancialSubject) {
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

  // Step 2: Extract fields
  const { amount, currency } = extractAmountFromEmail(fullText);
  const direction = detectEmailDirection(fullText);
  const accountHint = extractEmailAccountHint(fullText);
  const reference = extractEmailReference(fullText);
  const transactionType = detectEmailTransactionType(fullText);
  const merchant = extractEmailMerchant(fullText, input.from);

  // Step 3: Confidence
  let confidence = 0.45;
  if (isFinancialSender) confidence += 0.1;
  if (isFinancialSubject) confidence += 0.1;
  if (amount !== null) confidence += 0.15;
  if (direction !== null) confidence += 0.1;
  if (reference !== null) confidence += 0.05;
  if (merchant !== null) confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  // Step 4: Review flag
  let needsReview = false;
  let reviewReason: string | null = null;

  if (amount === null) {
    needsReview = true;
    reviewReason = "Could not extract amount from email";
  } else if (direction === null) {
    needsReview = true;
    reviewReason = "Could not determine debit/credit from email";
  } else if (confidence < 0.7) {
    needsReview = true;
    reviewReason = "Low email classification confidence";
  }

  return {
    isFinancial: true,
    direction,
    amount,
    currency,
    accountHint,
    merchant,
    balanceAfter: null, // Emails rarely include running balance
    reference,
    transactionType,
    confidence,
    needsReview,
    reviewReason,
  };
}
