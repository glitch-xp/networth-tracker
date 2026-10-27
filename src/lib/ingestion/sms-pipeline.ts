/**
 * SMS Ingestion Pipeline — PRD §6, §8, §9, §12, §13
 *
 * Source → ingestion → parser/classifier → normalized event →
 * deduplication → reconciliation → ledger
 *
 * This module orchestrates the full pipeline from raw SMS to
 * canonical ledger transaction.
 */

import { parseSMS } from "@/lib/ingestion/sms-parser";
import { getAIProvider } from "@/lib/ai/gemini-provider";
import { buildAIContext } from "@/lib/ai/privacy";
import type { ClassificationResult } from "@/lib/providers/interfaces";
import type { ParsedSMS } from "@/lib/ingestion/sms-parser";

export interface SMSPayload {
  message_id: string;
  sender: string;
  received_at: string;
  body: string;
}

export interface ProcessingResult {
  success: boolean;
  eventId?: string;
  transactionId?: string;
  status: "processed" | "needs_review" | "failed" | "ignored" | "duplicate";
  error?: string;
  confidence?: number;
}

/**
 * Merge deterministic parser results with AI classification.
 * Deterministic results take priority when they have high confidence.
 * AI fills in gaps (category, merchant disambiguation, etc).
 */
export function mergeParserAndAI(
  parsed: ParsedSMS,
  ai: ClassificationResult | null
): {
  direction: "credit" | "debit" | null;
  amount: number | null;
  currency: string;
  merchant: string | null;
  category: string | null;
  accountHint: string | null;
  transactionType: string | null;
  balanceAfter: number | null;
  reference: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
  classificationSource: string;
} {
  // If AI is unavailable, use parser-only results
  if (!ai) {
    return {
      direction: parsed.direction,
      amount: parsed.amount,
      currency: parsed.currency,
      merchant: parsed.merchant,
      category: null, // Parser doesn't categorize
      accountHint: parsed.accountHint,
      transactionType: parsed.transactionType,
      balanceAfter: parsed.balanceAfter,
      reference: parsed.reference,
      confidence: parsed.confidence,
      needsReview: parsed.needsReview,
      reviewReason: parsed.reviewReason,
      classificationSource: "deterministic",
    };
  }

  // Merge: prefer deterministic when available, AI fills gaps
  const direction = parsed.direction ?? ai.direction;
  const amount = parsed.amount ?? ai.amount;
  const merchant = parsed.merchant ?? ai.merchant;
  const category = ai.category; // Only AI provides category
  const accountHint = parsed.accountHint ?? ai.accountHint;
  const transactionType = parsed.transactionType ?? ai.transactionType;
  const balanceAfter = parsed.balanceAfter ?? ai.balanceAfter;
  const reference = parsed.reference ?? ai.reference;

  // Confidence: use higher of the two, weighted toward deterministic
  const confidence = Math.max(
    parsed.confidence,
    ai.confidence * 0.9 // Slight discount for AI confidence
  );

  // Needs review if either source says so
  const needsReview = parsed.needsReview || ai.needsReview || confidence < 0.7;
  const reviewReason = parsed.reviewReason || ai.reviewReason || null;

  return {
    direction,
    amount,
    currency: parsed.currency || ai.currency || "INR",
    merchant,
    category,
    accountHint,
    transactionType,
    balanceAfter,
    reference,
    confidence,
    needsReview,
    reviewReason,
    classificationSource: parsed.confidence > 0.8 ? "deterministic+ai" : "ai+deterministic",
  };
}

/**
 * Process an incoming SMS through the full pipeline.
 *
 * Uses a Supabase client passed in from the route handler
 * to keep the pipeline testable and avoid importing server deps.
 */
export async function processSMS(
  payload: SMSPayload,
  deviceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<ProcessingResult> {
  const externalId = `${deviceId}:${payload.message_id}`;

  // ─── Step 1: Idempotency check (PRD §42) ─────────────
  const { data: existing } = await supabase
    .from("ingestion_events")
    .select("id, processing_status")
    .eq("source_type", "sms")
    .eq("external_id", externalId)
    .single();

  if (existing) {
    return { success: true, status: "duplicate", eventId: existing.id };
  }

  // ─── Step 2: Create ingestion event ───────────────────
  const payloadHash = await hashPayload(payload.body);

  const { data: event, error: eventError } = await supabase
    .from("ingestion_events")
    .insert({
      user_id: userId,
      source_type: "sms",
      external_id: externalId,
      payload_hash: payloadHash,
      received_at: payload.received_at || new Date().toISOString(),
      processing_status: "processing",
    } as never)
    .select("id")
    .single();

  if (eventError || !event) {
    return { success: false, status: "failed", error: "Failed to create ingestion event" };
  }

  const eventId = (event as { id: string }).id;

  try {
    // ─── Step 3: Deterministic parse ──────────────────────
    const parsed = parseSMS(payload.body);

    // If not financial, mark as ignored
    if (!parsed.isFinancial) {
      await supabase
        .from("ingestion_events")
        .update({ processing_status: "ignored", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return { success: true, status: "ignored", eventId };
    }

    // ─── Step 4: AI classification (if available) ─────────
    let aiResult: ClassificationResult | null = null;
    try {
      const ai = getAIProvider();
      const { sanitizedMessage } = buildAIContext({
        smsBody: payload.body,
        sender: payload.sender,
        parsedAmount: parsed.amount,
        parsedDirection: parsed.direction,
        parsedAccountHint: parsed.accountHint,
      });

      aiResult = await ai.classify({
        content: sanitizedMessage,
        source: "sms",
        metadata: { sender: payload.sender },
      });
    } catch (error) {
      // AI failure is not fatal — deterministic parser continues (PRD §65)
      console.warn("AI classification failed, using deterministic parser only:", error);
    }

    // ─── Step 5: Merge results ────────────────────────────
    const merged = mergeParserAndAI(parsed, aiResult);

    if (!merged.amount || !merged.direction) {
      // Can't create a transaction without amount and direction
      await supabase
        .from("ingestion_events")
        .update({ processing_status: "needs_review", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return {
        success: true,
        status: "needs_review",
        eventId,
        confidence: merged.confidence,
      };
    }

    // ─── Step 6: Resolve account ──────────────────────────
    let accountId: string | null = null;
    if (merged.accountHint) {
      const { data: account } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("masked_identifier", merged.accountHint)
        .eq("is_active", true)
        .single();

      if (account) {
        accountId = (account as { id: string }).id;
      }
    }

    // ─── Step 7: Determine transaction type ───────────────
    let transactionType: string = "expense";
    if (merged.direction === "credit") {
      transactionType = "income";
    }
    if (merged.category === "Salary") transactionType = "income";
    if (merged.category === "Refund" || merged.transactionType === "refund") transactionType = "refund";
    if (merged.category === "Transfer" || merged.transactionType === "neft" || merged.transactionType === "imps") {
      // Could be a transfer — but we can't be sure without matching the other side
      // Leave as expense/income and let the user mark as transfer if needed
    }

    // ─── Step 8: Create transaction ───────────────────────
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        account_id: accountId,
        transaction_type: transactionType,
        direction: merged.direction,
        amount: merged.amount.toString(),
        currency: merged.currency,
        merchant: merged.merchant,
        description: null,
        category: merged.category,
        occurred_at: payload.received_at || new Date().toISOString(),
        reference: merged.reference,
        status: merged.needsReview ? "needs_review" : "confirmed",
        confidence: merged.confidence,
        needs_review: merged.needsReview,
        review_reason: merged.reviewReason,
        is_transfer: false,
        transfer_account_id: null,
      } as never)
      .select("id")
      .single();

    if (txError || !transaction) {
      await supabase
        .from("ingestion_events")
        .update({ processing_status: "failed", error_code: "tx_insert_failed", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return { success: false, status: "failed", error: "Failed to create transaction", eventId };
    }

    const transactionId = (transaction as { id: string }).id;

    // ─── Step 9: Link source to transaction (PRD §8) ──────
    await supabase
      .from("transaction_sources")
      .insert({
        transaction_id: transactionId,
        source_type: "sms",
        source_external_id: externalId,
        source_hash: payloadHash,
        source_metadata: {
          sender: payload.sender,
          device_id: deviceId,
          message_id: payload.message_id,
          classification_source: merged.classificationSource,
        },
        received_at: payload.received_at || new Date().toISOString(),
      } as never);

    // ─── Step 10: Create balance snapshot if present (PRD §24) ──
    if (merged.balanceAfter !== null && accountId) {
      await supabase
        .from("balance_snapshots")
        .insert({
          account_id: accountId,
          balance: merged.balanceAfter.toString(),
          currency: merged.currency,
          source: "sms",
          observed_at: payload.received_at || new Date().toISOString(),
          confidence: merged.confidence,
        } as never);
    }

    // ─── Step 11: Add to review queue if needed (PRD §9) ──
    if (merged.needsReview) {
      await supabase
        .from("review_queue")
        .insert({
          user_id: userId,
          entity_type: "transaction",
          entity_id: transactionId,
          reason: merged.reviewReason || "Needs manual review",
          confidence: merged.confidence,
          status: "pending",
        } as never);
    }

    // ─── Step 12: Mark ingestion as processed ─────────────
    const finalStatus = merged.needsReview ? "needs_review" : "processed";
    await supabase
      .from("ingestion_events")
      .update({ processing_status: finalStatus, processed_at: new Date().toISOString() } as never)
      .eq("id", eventId);

    return {
      success: true,
      status: merged.needsReview ? "needs_review" : "processed",
      eventId,
      transactionId,
      confidence: merged.confidence,
    };
  } catch (error) {
    // Mark as failed with retryable state
    await supabase
      .from("ingestion_events")
      .update({
        processing_status: "failed",
        error_code: error instanceof Error ? error.message : "unknown",
        processed_at: new Date().toISOString(),
      } as never)
      .eq("id", eventId);

    return {
      success: false,
      status: "failed",
      eventId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function hashPayload(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
