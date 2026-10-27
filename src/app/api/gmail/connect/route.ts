import { NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/gmail/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Ensure user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check limit (max 2 accounts)
    const { count } = await supabase
      .from("gmail_accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (count !== null && count >= 2) {
      return NextResponse.json(
        { error: "Maximum of 2 Gmail accounts allowed" },
        { status: 400 }
      );
    }

    // Generate auth URL with a state token (we'll just pass a simple flag for now, 
    // ideally this should be a secure random token stored in session)
    const state = "connect_gmail";
    const authUrl = getGmailAuthUrl(state);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("Gmail connect error:", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
