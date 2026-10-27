/**
 * AI Privacy Boundary — PRD §14, §61
 *
 * Sanitizes financial message content before sending to Gemini.
 * Never sends: full account numbers, card numbers, OAuth tokens,
 * full mailbox, email addresses, complete SMS history.
 *
 * Always sends: amount, currency, merchant, category, date,
 * masked account, transaction type, aggregated statistics.
 */

/**
 * Mask account numbers, card numbers, and other sensitive identifiers.
 */
export function maskIdentifiers(text: string): string {
  let masked = text;

  // Full account numbers (8+ digits)
  masked = masked.replace(/\b\d{8,}\b/g, (match) => {
    return "XXXX" + match.slice(-4);
  });

  // Card numbers (4 groups of 4, possibly with spaces/dashes)
  masked = masked.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    (match) => {
      return "XXXX-XXXX-XXXX-" + match.slice(-4);
    }
  );

  // Email addresses
  masked = masked.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL_REDACTED]"
  );

  // Phone numbers (10+ digits)
  masked = masked.replace(/\b\d{10,13}\b/g, "[PHONE_REDACTED]");

  // PAN numbers
  masked = masked.replace(/[A-Z]{5}\d{4}[A-Z]/g, "[PAN_REDACTED]");

  // Aadhaar numbers (12 digits with spaces)
  masked = masked.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, "[AADHAAR_REDACTED]");

  return masked;
}

/**
 * Build a sanitized context object for AI consumption.
 * Only includes fields that are safe to send to external AI.
 */
export function buildAIContext(input: {
  smsBody: string;
  sender: string;
  parsedAmount?: number | null;
  parsedDirection?: string | null;
  parsedAccountHint?: string | null;
}): {
  sanitizedMessage: string;
  metadata: Record<string, unknown>;
} {
  const sanitizedMessage = maskIdentifiers(input.smsBody);

  return {
    sanitizedMessage,
    metadata: {
      sender: input.sender,
      // Only include already-extracted structured data
      parsedAmount: input.parsedAmount ?? null,
      parsedDirection: input.parsedDirection ?? null,
      // Account hint is already masked (XXXX1234 format)
      accountHint: input.parsedAccountHint ?? null,
      messageLength: input.smsBody.length,
    },
  };
}

/**
 * Delimit untrusted content to prevent prompt injection — PRD §56
 *
 * Wraps user-provided content in clear delimiters so the AI model
 * treats it strictly as data, not instructions.
 */
export function delimitUntrustedContent(content: string): string {
  return `<SMS_DATA_START>\n${content}\n<SMS_DATA_END>`;
}
