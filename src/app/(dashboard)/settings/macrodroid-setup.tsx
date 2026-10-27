"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Code } from "lucide-react";

export function MacroDroidSetup() {
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/ingest/sms`
      : "https://your-domain.com/api/ingest/sms";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const sampleMacro = `{
  "message_id": "{sms_id}",
  "sender": "{sms_sender}",
  "received_at": "{sms_received}",
  "body": "{sms_body}"
}`;

  const hmacScript = `// MacroDroid Shell Script Action
// Generate HMAC signature for SMS webhook
DEVICE_ID="your-device-id"
SECRET="your-device-secret"
TIMESTAMP=$(date +%s%3N)
NONCE=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32)
BODY='${sampleMacro}'

MESSAGE="$DEVICE_ID:$TIMESTAMP:$NONCE:$BODY"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-ID: $DEVICE_ID" \\
  -H "X-Timestamp: $TIMESTAMP" \\
  -H "X-Nonce: $NONCE" \\
  -H "X-Signature: $SIGNATURE" \\
  -d "$BODY"`;

  return (
    <div className="space-y-4">
      {/* Webhook URL */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          Webhook URL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input flex-1"
            value={webhookUrl}
            readOnly
          />
          <button
            onClick={() => copyToClipboard(webhookUrl, "url")}
            className="btn btn-secondary"
          >
            {copied === "url" ? (
              <Check className="h-4 w-4 text-[var(--color-positive)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Device Secret */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          Device Secret
        </label>
        <div className="flex items-center gap-2">
          <input
            type={showSecret ? "text" : "password"}
            className="input flex-1"
            value="Configure via MACRODROID_DEVICE_SECRET env var"
            readOnly
          />
          <button
            onClick={() => setShowSecret(!showSecret)}
            className="btn btn-secondary"
          >
            {showSecret ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Set <code className="rounded bg-[var(--bg-tertiary)] px-1">MACRODROID_DEVICE_SECRET</code> in your .env.local
        </p>
      </div>

      {/* Required Headers */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          Required Headers
        </label>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-tertiary)]">
                <th className="pb-2 text-left font-medium">Header</th>
                <th className="pb-2 text-left font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              <tr className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 font-mono text-[var(--accent-primary)]">X-Device-ID</td>
                <td className="py-1.5">Unique device identifier</td>
              </tr>
              <tr className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 font-mono text-[var(--accent-primary)]">X-Timestamp</td>
                <td className="py-1.5">Unix timestamp in ms (±5min tolerance)</td>
              </tr>
              <tr className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 font-mono text-[var(--accent-primary)]">X-Nonce</td>
                <td className="py-1.5">Random string (single-use)</td>
              </tr>
              <tr className="border-t border-[var(--border-subtle)]">
                <td className="py-1.5 font-mono text-[var(--accent-primary)]">X-Signature</td>
                <td className="py-1.5">HMAC-SHA256(secret, device:ts:nonce:body)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            JSON Payload Format
          </label>
          <button
            onClick={() => copyToClipboard(sampleMacro, "payload")}
            className="btn btn-ghost text-[0.625rem]"
          >
            {copied === "payload" ? (
              <>
                <Check className="h-3 w-3 text-[var(--color-positive)]" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-xs text-[var(--text-secondary)]">
          {sampleMacro}
        </pre>
      </div>

      {/* Full cURL example */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Full Shell Script (for MacroDroid)
          </label>
          <button
            onClick={() => copyToClipboard(hmacScript, "script")}
            className="btn btn-ghost text-[0.625rem]"
          >
            {copied === "script" ? (
              <>
                <Check className="h-3 w-3 text-[var(--color-positive)]" /> Copied
              </>
            ) : (
              <>
                <Code className="h-3 w-3" /> Copy Script
              </>
            )}
          </button>
        </div>
        <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-[0.625rem] leading-relaxed text-[var(--text-secondary)]">
          {hmacScript}
        </pre>
      </div>
    </div>
  );
}
