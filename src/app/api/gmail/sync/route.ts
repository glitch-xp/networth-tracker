import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGmailClient, syncHistory, listFinancialMessages, getMessageContent } from "@/lib/gmail/client";
import { processGmailMessage } from "@/lib/gmail/gmail-pipeline";

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Determine user ID. If called via cron/service role, body might contain userId.
    let userId = user?.id;
    let accountId = null;

    try {
      const body = await request.json();
      if (body.user_id) userId = body.user_id;
      if (body.account_id) accountId = body.account_id;
    } catch {
      // Body is optional
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch accounts to sync
    let query = supabase
      .from("gmail_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);
      
    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No active Gmail accounts found" }, { status: 404 });
    }

    const results = [];

    for (const account of (accounts as any[])) {
      try {
        // Mark as syncing
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
          // Incremental sync
          try {
            const syncResult = await syncHistory(gmail, account.history_id);
            messageIdsToProcess = syncResult.messageIds;
            newHistoryId = syncResult.newHistoryId;
          } catch (historyError) {
            console.warn(`History sync failed for ${account.email}, falling back to full fetch`, historyError);
            // If history expired (404), fall back to fetching recent
            const recent = await listFinancialMessages(gmail, { maxResults: 50 });
            messageIdsToProcess = recent.messages.map(m => m.id);
          }
        } else {
          // First time sync — fetch recent financial messages
          const recent = await listFinancialMessages(gmail, { maxResults: 100 });
          messageIdsToProcess = recent.messages.map(m => m.id);
          
          // Get a current history ID by calling getProfile
          try {
            const profile = await gmail.users.getProfile({ userId: 'me' });
            newHistoryId = profile.data.historyId || null;
          } catch (e) {
            console.error("Failed to get profile for historyId", e);
          }
        }

        // Deduplicate message IDs just in case
        messageIdsToProcess = [...new Set(messageIdsToProcess)];
        let processedCount = 0;
        let createdCount = 0;

        // Process messages
        for (const msgId of messageIdsToProcess) {
          try {
            const msgContent = await getMessageContent(gmail, msgId);
            const processResult = await processGmailMessage(
              msgContent,
              account.id,
              account.email,
              supabase,
              userId
            );
            
            processedCount++;
            if (processResult.status === "processed" || processResult.status === "needs_review") {
              createdCount++;
            }
          } catch (msgError) {
            console.error(`Error processing message ${msgId}:`, msgError);
          }
        }

        // Update account status
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
        console.error(`Sync failed for account ${account.email}:`, accountError);
        
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
    console.error("Gmail sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
