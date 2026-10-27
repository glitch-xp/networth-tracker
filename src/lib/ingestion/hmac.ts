/**
 * HMAC signature verification for MacroDroid SMS ingestion.
 * PRD §12: device_id + secret + HMAC + timestamp + nonce + replay protection
 *
 * Headers expected:
 *   X-Device-ID, X-Timestamp, X-Nonce, X-Signature
 *
 * Signature = HMAC-SHA256(secret, `${device_id}:${timestamp}:${nonce}:${body}`)
 */

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory nonce store. In production, use Redis or a DB table.
// Nonces are cleaned up periodically to prevent unbounded growth.
const usedNonces = new Map<string, number>();
let lastCleanup = Date.now();

function cleanupNonces() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // clean up at most once per minute
  for (const [nonce, timestamp] of usedNonces) {
    if (now - timestamp > NONCE_TTL_MS) {
      usedNonces.delete(nonce);
    }
  }
  lastCleanup = now;
}

export interface HmacVerificationResult {
  valid: boolean;
  error?: string;
  deviceId?: string;
}

export async function verifyHmacSignature(
  headers: Headers,
  body: string,
  deviceSecret: string
): Promise<HmacVerificationResult> {
  const deviceId = headers.get("x-device-id");
  const timestamp = headers.get("x-timestamp");
  const nonce = headers.get("x-nonce");
  const signature = headers.get("x-signature");

  // Check all required headers present
  if (!deviceId || !timestamp || !nonce || !signature) {
    return { valid: false, error: "Missing required security headers" };
  }

  // Validate timestamp format and freshness
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  const now = Date.now();
  const age = Math.abs(now - ts);
  if (age > TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, error: "Timestamp expired or too far in the future" };
  }

  // Check nonce hasn't been used (replay protection)
  cleanupNonces();
  const nonceKey = `${deviceId}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return { valid: false, error: "Nonce already used (replay detected)" };
  }

  // Compute expected HMAC
  const message = `${deviceId}:${timestamp}:${nonce}:${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(deviceSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: "Invalid signature" };
  }

  // Mark nonce as used
  usedNonces.set(nonceKey, now);

  return { valid: true, deviceId };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Simple in-memory rate limiter per device.
 * In production, use Redis or a proper rate limiting service.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per device

export function checkRateLimit(deviceId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(deviceId);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(deviceId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}
