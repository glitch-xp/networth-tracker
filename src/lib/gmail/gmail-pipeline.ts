/**
 * Gmail Processing Pipeline — PRD §10, §11
 *
 * Source → fetch → parse/classify → dedup → ledger
 *
 * Orchestrates the full pipeline from Gmail message to
 * canonical ledger transaction, with cross-source deduplication.
 */

import { parseEmail } from "@/lib/gmail/email-parser";
import { getAIProvider } from "@/lib/ai/gemini-provider";
import { buildAIContext } from "@/lib/ai/privacy";
import { mergeParserAndAI } from "@/lib/ingestion/sms-pipeline";
import { findDuplicate, mergeSource } from "@/lib/ingestion/deduplication";
import type { GmailMessage } from "@/lib/gmail/client";
import type { ParsedSMS } from "@/lib/ingestion/sms-parser";
import type { ClassificationResult } from "@/lib/providers/interfaces";

export interface GmailProcessingResult {
  success: boolean;
  status: "processed" | "merged" | "needs_review" | "ignored" | "duplicate" | "failed";
  eventId?: string;
  transactionId?: string;
  mergedWithTransactionId?: string;
  confidence?: number;
  error?: string;
}

/**
 * Process a single Gmail message through the pipeline.
 */
export async function processGmailMessage(
  message: GmailMessage,
  gmailAccountId: string,
  gmailEmail: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<GmailProcessingResult> {
  const externalId = `${gmailEmail}:${message.id}`;

  // ─── Step 1: Idempotency check ────────────────────────
  const { data: existing } = await supabase
    .from("ingestion_events")
    .select("id, processing_status")
    .eq("source_type", "gmail")
    .eq("external_id", externalId)
    .single();

  if (existing) {
    return { success: true, status: "duplicate", eventId: existing.id };
  }

  // ─── Step 2: Create ingestion event ───────────────────
  const { data: event, error: eventError } = await supabase
    .from("ingestion_events")
    .insert({
      user_id: userId,
      source_type: "gmail",
      external_id: externalId,
      payload_hash: await hashContent(message.subject + message.body),
      received_at: message.date ? new Date(message.date).toISOString() : new Date().toISOString(),
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
    const parsed = parseEmail({
      from: message.from,
      subject: message.subject,
      body: message.body,
      snippet: message.snippet,
    });

    // If not financial, mark as ignored
    if (!parsed.isFinancial) {
      await supabase
        .from("ingestion_events")
        .update({ processing_status: "ignored", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return { success: true, status: "ignored", eventId };
    }

    // ─── Step 4: AI classification ────────────────────────
    let aiResult: ClassificationResult | null = null;
    try {
      const ai = getAIProvider();
      const { sanitizedMessage } = buildAIContext({
        smsBody: `Subject: ${message.subject}\n\n${message.body.slice(0, 1000)}`,
        sender: message.from,
        parsedAmount: parsed.amount,
        parsedDirection: parsed.direction,
        parsedAccountHint: parsed.accountHint,
      });

      aiResult = await ai.classify({
        content: sanitizedMessage,
        source: "gmail",
        metadata: { sender: message.from, subject: message.subject },
      });
    } catch {
      console.warn("AI classification failed for email, using parser only");
    }

    // ─── Step 5: Merge parser + AI ────────────────────────
    // Convert ParsedEmail to ParsedSMS format for reuse
    const parsedAsSMS: ParsedSMS = {
      isFinancial: parsed.isFinancial,
      direction: parsed.direction,
      amount: parsed.amount,
      currency: parsed.currency,
      accountHint: parsed.accountHint,
      merchant: parsed.merchant,
      balanceAfter: parsed.balanceAfter,
      reference: parsed.reference,
      transactionType: parsed.transactionType,
      confidence: parsed.confidence,
      needsReview: parsed.needsReview,
      reviewReason: parsed.reviewReason,
    };

    const merged = mergeParserAndAI(parsedAsSMS, aiResult);

    if (!merged.amount || !merged.direction) {
      await supabase
        .from("ingestion_events")
        .update({ processing_status: "needs_review", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return { success: true, status: "needs_review", eventId, confidence: merged.confidence };
    }

    // ─── Step 6: Cross-source deduplication (PRD §8) ──────
    const candidateTime = message.date
      ? new Date(message.date).toISOString()
      : new Date().toISOString();

    // Fetch recent transactions within dedup window
    const tenMinutesAgo = new Date(new Date(candidateTime).getTime() - 15 * 60 * 1000).toISOString();
    const tenMinutesAfter = new Date(new Date(candidateTime).getTime() + 15 * 60 * 1000).toISOString();

    const { data: recentTxs } = await supabase
      .from("transactions")
      .select("id, direction, amount, currency, merchant, reference, occurred_at, account_id")
      .eq("user_id", userId)
      .gte("occurred_at", tenMinutesAgo)
      .lte("occurred_at", tenMinutesAfter);

    const dedupResult = findDuplicate(
      {
        direction: merged.direction,
        amount: merged.amount,
        currency: merged.currency,
        accountHint: merged.accountHint,
        merchant: merged.merchant,
        reference: merged.reference,
        occurredAt: candidateTime,
      },
      (recentTxs as { id: string; direction: string; amount: string; currency: string; merchant: string | null; reference: string | null; occurred_at: string; account_id: string | null }[]) || []
    );

    // If duplicate found and should merge
    if (dedupResult.shouldMerge && dedupResult.matchedTransactionId) {
      await mergeSource(
        dedupResult.matchedTransactionId,
        "gmail",
        externalId,
        {
          gmail_account_id: gmailAccountId,
          gmail_message_id: message.id,
          from: message.from,
          subject: message.subject,
          dedup_match_type: dedupResult.matchType,
          dedup_confidence: dedupResult.confidence,
        },
        supabase
      );

      await supabase
        .from("ingestion_events")
        .update({ processing_status: "processed", processed_at: new Date().toISOString() } as never)
        .eq("id", eventId);

      return {
        success: true,
        status: "merged",
        eventId,
        mergedWithTransactionId: dedupResult.matchedTransactionId,
        confidence: dedupResult.confidence,
      };
    }

    // If uncertain match, flag for review instead of creating new
    if (dedupResult.matchType === "uncertain" && dedupResult.matchedTransactionId) {
      merged.needsReview = true;
      merged.reviewReason = `Possible duplicate: ${dedupResult.reason}`;
    }

    // ─── Step 7: Resolve account ──────────────────────────
    let accountId: string | null = null;
    if (merged.accountHint) {
      const { data: account } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("masked_identifier", merged.accountHint)
        .eq("is_active", true)
        .single();

      if (account) accountId = (account as { id: string }).id;
    }

    // ─── Step 8: Create transaction ───────────────────────
    let transactionType = "expense";
    if (merged.direction === "credit") transactionType = "income";
    if (merged.category === "Salary") transactionType = "income";
    if (merged.transactionType === "refund") transactionType = "refund";

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
        description: message.subject.slice(0, 200),
        category: merged.category,
        occurred_at: candidateTime,
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

    // ─── Step 9: Link source ──────────────────────────────
    await supabase
      .from("transaction_sources")
      .insert({
        transaction_id: transactionId,
        source_type: "gmail",
        source_external_id: externalId,
        source_metadata: {
          gmail_account_id: gmailAccountId,
          gmail_message_id: message.id,
          from: message.from,
          subject: message.subject,
          classification_source: merged.classificationSource,
        },
        received_at: candidateTime,
      } as never);

    // ─── Step 10: Review queue if needed ───────────────────
    if (merged.needsReview) {
      await supabase
        .from("review_queue")
        .insert({
          user_id: userId,
          entity_type: "transaction",
          entity_id: transactionId,
          reason: merged.reviewReason || "Email needs manual review",
          confidence: merged.confidence,
          status: "pending",
        } as never);
    }

    // ─── Step 11: Update ingestion event ──────────────────
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
    await supabase
      .from("ingestion_events")
      .update({
        processing_status: "failed",
        error_code: error instanceof Error ? error.message : "unknown",
        processed_at: new Date().toISOString(),
      } as never)
      .eq("id", eventId);

    return { success: false, status: "failed", eventId, error: String(error) };
  }
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
