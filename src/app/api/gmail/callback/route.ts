import { NextResponse } from "next/server";
import { exchangeCodeForTokens, createGmailClient, getGmailProfile, setupWatch } from "@/lib/gmail/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  if (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=gmail_auth_denied", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=missing_code", request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/settings", request.url));
    }

    // 1. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Did not receive both access and refresh tokens. Make sure to force consent prompt.");
    }

    // 2. Get user profile (email address)
    const { gmail } = createGmailClient(tokens.access_token, tokens.refresh_token, tokens.expiry_date?.toString());
    const emailAddress = await getGmailProfile(gmail);

    // 3. Set up push notifications (watch)
    // Assuming a Pub/Sub topic is configured. If not, this might fail, 
    // but we can fall back to polling.
    const pubSubTopic = process.env.GMAIL_PUBSUB_TOPIC || "projects/your-project/topics/gmail-push";
    let watchDetails = { historyId: "", expiration: "" };
    
    try {
      if (process.env.GMAIL_PUBSUB_TOPIC) {
        watchDetails = await setupWatch(gmail, pubSubTopic);
      }
    } catch (watchErr) {
      console.warn("Failed to set up Gmail watch, falling back to polling", watchErr);
    }

    // 4. Save to database
    // Use upsert to handle reconnects
    const { error: dbError } = await supabase
      .from("gmail_accounts")
      .upsert({
        user_id: user.id,
        email: emailAddress,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        history_id: watchDetails.historyId || null,
        watch_expiration: watchDetails.expiration || null,
        sync_status: "idle",
        is_active: true,
      } as never, { onConflict: "user_id, email" });

    if (dbError) {
      console.error("Database error saving Gmail account:", dbError);
      throw new Error("Failed to save account details");
    }

    return NextResponse.redirect(new URL("/settings?success=gmail_connected", request.url));

  } catch (error) {
    console.error("Gmail callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=gmail_connection_failed", request.url));
  }
}
