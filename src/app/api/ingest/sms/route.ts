/**
 * SMS Ingestion Endpoint — PRD §12
 *
 * POST /api/ingest/sms
 *
 * MacroDroid sends intercepted SMS messages here.
 * Security chain: HMAC → replay protection → rate limit → process.
 *
 * This route uses the Supabase service role client because the
 * device webhook doesn't carry a user session cookie. The
 * device_id → user mapping is handled via the MacroDroid
 * device secret which is unique per user.
 *
 * For now, we use the server client with the anon key since
 * we only have one user. In production, the device_secret
 * would map to a specific user_id.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyHmacSignature, checkRateLimit } from "@/lib/ingestion/hmac";
import { processSMS, type SMSPayload } from "@/lib/ingestion/sms-pipeline";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // ─── Step 1: Read body ──────────────────────────────
    const body = await request.text();
    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    // ─── Step 2: HMAC verification ──────────────────────
    const deviceSecret = process.env.MACRODROID_DEVICE_SECRET;
    if (!deviceSecret) {
      console.error("MACRODROID_DEVICE_SECRET not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const hmacResult = await verifyHmacSignature(
      request.headers,
      body,
      deviceSecret
    );

    if (!hmacResult.valid) {
      console.warn(`HMAC verification failed: ${hmacResult.error}`);
      return NextResponse.json(
        { error: hmacResult.error },
        { status: 401 }
      );
    }

    const deviceId = hmacResult.deviceId!;

    // ─── Step 3: Rate limiting ──────────────────────────
    const rateLimit = checkRateLimit(deviceId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // ─── Step 4: Parse payload ──────────────────────────
    let payload: SMSPayload;
    try {
      payload = JSON.parse(body) as SMSPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload.message_id || !payload.sender || !payload.body) {
      return NextResponse.json(
        { error: "Missing required fields: message_id, sender, body" },
        { status: 400 }
      );
    }

    // ─── Step 5: Create Supabase client for device ──────
    // Since this is a webhook (no user cookie), we create a
    // server client. RLS policies use user_id, which we pass
    // explicitly. For single-user, we look up the sole user.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // No cookies to set for API routes
          },
        },
      }
    );

    // For single-user: get the owner user.
    // In multi-user, this would be a device_id → user_id lookup.
    const { data: userData } = await supabase.auth.admin.listUsers();
    const userId = userData?.users?.[0]?.id;

    if (!userId) {
      // Fallback: try from a device registry table (future)
      return NextResponse.json(
        { error: "No user found for device" },
        { status: 403 }
      );
    }

    // ─── Step 6: Process through pipeline ───────────────
    const result = await processSMS(payload, deviceId, supabase, userId);

    const elapsed = Date.now() - startTime;

    return NextResponse.json(
      {
        success: result.success,
        status: result.status,
        event_id: result.eventId,
        transaction_id: result.transactionId,
        confidence: result.confidence,
        processing_time_ms: elapsed,
      },
      {
        status: result.success ? 200 : 500,
        headers: {
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    console.error("SMS ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Block other methods
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
