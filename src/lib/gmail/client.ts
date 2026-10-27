/**
 * Gmail API Client — PRD §10
 *
 * Wraps Google Gmail API for:
 * - OAuth2 token management
 * - Listing/fetching messages
 * - Incremental sync via historyId
 * - Watch setup for push notifications
 *
 * Read-only access only. Never sends, deletes, or modifies emails.
 */

import { google, type gmail_v1 } from "googleapis";

// Narrowest read-only scope — PRD §10
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet: string;
  labels: string[];
}

export interface GmailSyncResult {
  messagesProcessed: number;
  newHistoryId: string | null;
  errors: string[];
}

/**
 * Create an OAuth2 client for Gmail API.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/gmail/callback`
  );
}

/**
 * Generate the Gmail OAuth authorization URL.
 * Requests read-only access with offline refresh tokens.
 */
export function getGmailAuthUrl(state?: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent", // Force consent to get refresh token
    state: state || "",
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Create an authenticated Gmail API client using stored tokens.
 */
export function createGmailClient(
  accessToken: string,
  refreshToken: string,
  expiresAt?: string | null
) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiresAt ? new Date(expiresAt).getTime() : undefined,
  });

  // Listen for token refresh
  oauth2Client.on("tokens", (tokens) => {
    // Tokens will be refreshed automatically; the caller should
    // update the stored tokens via the returned event
    console.log("Gmail tokens refreshed");
  });

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2Client }),
    oauth2Client,
  };
}

/**
 * Get the email address associated with the authenticated account.
 */
export async function getGmailProfile(
  gmail: gmail_v1.Gmail
): Promise<string> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress || "";
}

/**
 * List recent messages matching financial senders.
 * Uses Gmail search operators to filter for likely financial emails.
 */
export async function listFinancialMessages(
  gmail: gmail_v1.Gmail,
  options: {
    maxResults?: number;
    afterDate?: string; // YYYY/MM/DD format
    pageToken?: string;
  } = {}
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string }> {
  // Gmail search query for financial emails
  const financialQuery = [
    "from:alerts@* OR from:noreply@* OR from:transactions@* OR from:statement@*",
    "OR from:*bank* OR from:*paytm* OR from:*phonepe* OR from:*gpay* OR from:*paypal*",
    "OR from:*zerodha* OR from:*groww* OR from:*kuvera* OR from:*cams*",
    "OR from:*insurance* OR from:*policy* OR from:*mutual*",
    "OR subject:transaction OR subject:payment OR subject:credited OR subject:debited",
    "OR subject:receipt OR subject:invoice OR subject:statement OR subject:salary",
    "OR subject:dividend OR subject:refund OR subject:bill",
  ].join(" ");

  const query = options.afterDate
    ? `(${financialQuery}) after:${options.afterDate}`
    : financialQuery;

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: options.maxResults || 20,
    pageToken: options.pageToken,
  });

  return {
    messages: (response.data.messages || []).map((m) => ({
      id: m.id!,
      threadId: m.threadId!,
    })),
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * Fetch a single message and extract its content.
 */
export async function getMessageContent(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<GmailMessage> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  // Extract body
  const body = extractBody(msg.data.payload);

  return {
    id: msg.data.id!,
    threadId: msg.data.threadId!,
    from: getHeader("from"),
    to: getHeader("to"),
    subject: getHeader("subject"),
    date: getHeader("date"),
    body,
    snippet: msg.data.snippet || "",
    labels: msg.data.labelIds || [],
  };
}

/**
 * Extract text body from Gmail message payload.
 * Handles multipart messages recursively.
 */
function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): string {
  if (!payload) return "";

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart: look for text/plain first, then text/html
  if (payload.parts) {
    // Prefer text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }

    // Fall back to text/html (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = Buffer.from(part.body.data, "base64url").toString("utf-8");
        return stripHtml(html);
      }
    }

    // Recurse into nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

/**
 * Strip HTML tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Incremental sync using historyId — PRD §10
 * Only fetches messages that arrived since the last historyId.
 */
export async function syncHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<{
  messageIds: string[];
  newHistoryId: string;
}> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let newHistoryId = startHistoryId;

  do {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
    });

    if (response.data.history) {
      for (const record of response.data.history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            if (added.message?.id) {
              messageIds.push(added.message.id);
            }
          }
        }
      }
    }

    newHistoryId = response.data.historyId || startHistoryId;
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return { messageIds, newHistoryId };
}

/**
 * Set up Gmail push notifications via Pub/Sub watch.
 */
export async function setupWatch(
  gmail: gmail_v1.Gmail,
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
    },
  });

  return {
    historyId: response.data.historyId || "",
    expiration: response.data.expiration
      ? new Date(parseInt(response.data.expiration)).toISOString()
      : "",
  };
}
