import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createGmailClient, syncHistory, listFinancialMessages, getMessageContent, getGmailProfile } from "@/lib/gmail/client";
import { processGmailMessage } from "@/lib/gmail/gmail-pipeline";

/**
 * Cron route to periodically sync all active Gmail accounts.
 * This should be called by a cron service (e.g., Vercel Cron) every 5-15 minutes.
 * PRD §10: Periodic reconciliation sync
 */
export async function GET(request: Request) {
  // Simple auth to ensure only the cron service can trigger this
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Use service role key to bypass RLS for background processing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("Supabase service role key not configured, cron sync skipped");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("gmail_accounts")
      .select("*")
      .eq("is_active", true);

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json({ status: "No active accounts to sync" });
    }

    const results = [];

    for (const account of (accounts as any[])) {
      try {
        await supabase
          .from("gmail_accounts")
          .update({ sync_status: "syncing" } as never)
          .eq("id", account.id);

        const { gmail } = createGmailClient(
          account.access_token,
          account.refresh_token,
          account.token_expires_at
        );

        let messageIdsToProcess: string[] = [];
        let newHistoryId = account.history_id;

        if (account.history_id) {
          try {
            const syncResult = await syncHistory(gmail, account.history_id);
            messageIdsToProcess = syncResult.messageIds;
            newHistoryId = syncResult.newHistoryId;
          } catch (historyError) {
            console.warn(`History sync failed for ${account.email}, falling back to full fetch`, historyError);
            const recent = await listFinancialMessages(gmail, { maxResults: 50 });
            messageIdsToProcess = recent.messages.map(m => m.id);
          }
        } else {
          const recent = await listFinancialMessages(gmail, { maxResults: 100 });
          messageIdsToProcess = recent.messages.map(m => m.id);
          
          try {
            const profile = await getGmailProfile(gmail);
            // Re-fetch profile to get historyId
            const profileReq = await gmail.users.getProfile({ userId: 'me' });
            newHistoryId = profileReq.data.historyId || null;
          } catch (e) {
             console.error("Failed to get profile for historyId", e);
          }
        }

        messageIdsToProcess = [...new Set(messageIdsToProcess)];
        let processedCount = 0;
        let createdCount = 0;

        for (const msgId of messageIdsToProcess) {
          try {
            const msgContent = await getMessageContent(gmail, msgId);
            const processResult = await processGmailMessage(
              msgContent,
              account.id,
              account.email,
              supabase,
              account.user_id
            );
            
            processedCount++;
            if (processResult.status === "processed" || processResult.status === "needs_review") {
              createdCount++;
            }
          } catch (msgError) {
             console.error(`Error processing message ${msgId}:`, msgError);
          }
        }

        await supabase
          .from("gmail_accounts")
          .update({
            history_id: newHistoryId,
            last_sync_at: new Date().toISOString(),
            sync_status: "idle",
            error_message: null
          } as never)
          .eq("id", account.id);

        results.push({
          email: account.email,
          success: true,
          messagesFound: messageIdsToProcess.length,
          messagesProcessed: processedCount,
          transactionsCreated: createdCount
        });

      } catch (accountError) {
        console.error(`Cron sync failed for account ${account.email}:`, accountError);
        await supabase
          .from("gmail_accounts")
          .update({
            sync_status: "error",
            error_message: String(accountError)
          } as never)
          .eq("id", account.id);

        results.push({
          email: account.email,
          success: false,
          error: String(accountError)
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      processing_time_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
