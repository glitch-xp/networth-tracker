/**
 * Cross-Source Deduplication Engine — PRD §8
 *
 * Prevents double-counting when the same transaction arrives
 * from multiple sources (SMS + Gmail).
 *
 * Fingerprint = direction + amount + currency + account + timestamp ±10min + merchant + reference
 *
 * Matching tiers:
 * 1. Strong reference match (UTR/RRN) → auto-merge
 * 2. High-value fields match without reference → merge with high confidence
 * 3. Uncertain match → create review candidate
 */

export interface DedupCandidate {
  direction: "credit" | "debit" | null;
  amount: number | null;
  currency: string;
  accountHint: string | null;
  merchant: string | null;
  reference: string | null;
  occurredAt: string;
}

export interface DedupMatch {
  matchType: "strong_reference" | "high_confidence" | "uncertain" | "no_match";
  matchedTransactionId: string | null;
  confidence: number;
  shouldMerge: boolean;
  reason: string;
}

const TIME_WINDOW_MS = 10 * 60 * 1000; // ±10 minutes

/**
 * Find potential duplicate transactions for a new candidate.
 *
 * Pass in recent transactions from the database.
 * Returns the best match if any.
 */
export function findDuplicate(
  candidate: DedupCandidate,
  existingTransactions: {
    id: string;
    direction: string;
    amount: string;
    currency: string;
    merchant: string | null;
    reference: string | null;
    occurred_at: string;
    account_id: string | null;
  }[]
): DedupMatch {
  if (!candidate.amount || !candidate.direction) {
    return {
      matchType: "no_match",
      matchedTransactionId: null,
      confidence: 0,
      shouldMerge: false,
      reason: "Candidate has no amount or direction",
    };
  }

  let bestMatch: DedupMatch = {
    matchType: "no_match",
    matchedTransactionId: null,
    confidence: 0,
    shouldMerge: false,
    reason: "No matching transaction found",
  };

  for (const tx of existingTransactions) {
    const txAmount = parseFloat(tx.amount);
    const txTime = new Date(tx.occurred_at).getTime();
    const candidateTime = new Date(candidate.occurredAt).getTime();

    // Time window check
    if (Math.abs(txTime - candidateTime) > TIME_WINDOW_MS) continue;

    // ─── Tier 1: Strong reference match ───────────────
    if (
      candidate.reference &&
      tx.reference &&
      candidate.reference.toUpperCase() === tx.reference.toUpperCase()
    ) {
      return {
        matchType: "strong_reference",
        matchedTransactionId: tx.id,
        confidence: 0.99,
        shouldMerge: true,
        reason: `Reference match: ${candidate.reference}`,
      };
    }

    // ─── Tier 2: High-value field match ───────────────
    let fieldMatchScore = 0;
    let matchedFields: string[] = [];

    // Amount match (exact)
    if (txAmount === candidate.amount) {
      fieldMatchScore += 0.35;
      matchedFields.push("amount");
    }

    // Direction match
    if (tx.direction === candidate.direction) {
      fieldMatchScore += 0.25;
      matchedFields.push("direction");
    }

    // Currency match
    if (tx.currency === candidate.currency) {
      fieldMatchScore += 0.05;
      matchedFields.push("currency");
    }

    // Merchant match (fuzzy)
    if (candidate.merchant && tx.merchant) {
      const sim = fuzzyMatch(
        candidate.merchant.toLowerCase(),
        tx.merchant.toLowerCase()
      );
      if (sim > 0.6) {
        fieldMatchScore += 0.15 * sim;
        matchedFields.push("merchant");
      }
    }

    // Amount + direction match is the minimum for considering a duplicate
    if (fieldMatchScore >= 0.55 && matchedFields.includes("amount") && matchedFields.includes("direction")) {
      const confidence = Math.min(fieldMatchScore + 0.1, 0.95); // Cap at 0.95 without reference

      if (confidence > bestMatch.confidence) {
        if (confidence >= 0.8) {
          bestMatch = {
            matchType: "high_confidence",
            matchedTransactionId: tx.id,
            confidence,
            shouldMerge: true,
            reason: `Field match: ${matchedFields.join(", ")} (${Math.round(confidence * 100)}%)`,
          };
        } else {
          bestMatch = {
            matchType: "uncertain",
            matchedTransactionId: tx.id,
            confidence,
            shouldMerge: false,
            reason: `Possible duplicate: ${matchedFields.join(", ")} (${Math.round(confidence * 100)}%)`,
          };
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Merge a new source into an existing canonical transaction.
 * Links the new source to the existing transaction via transaction_sources.
 */
export async function mergeSource(
  transactionId: string,
  sourceType: "sms" | "gmail",
  sourceExternalId: string,
  sourceMetadata: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<boolean> {
  const { error } = await supabase
    .from("transaction_sources")
    .insert({
      transaction_id: transactionId,
      source_type: sourceType,
      source_external_id: sourceExternalId,
      source_metadata: sourceMetadata,
      received_at: new Date().toISOString(),
    } as never);

  return !error;
}

/**
 * Simple fuzzy string matching using Levenshtein-like similarity.
 */
function fuzzyMatch(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  // Check if shorter is contained in longer
  if (longer.includes(shorter)) return shorter.length / longer.length + 0.3;

  // Character overlap
  const set1 = new Set(a.split(""));
  const set2 = new Set(b.split(""));
  const intersection = new Set([...set1].filter((c) => set2.has(c)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
