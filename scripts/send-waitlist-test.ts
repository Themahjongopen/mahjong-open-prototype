/**
 * ============================================================================
 *  TEST-ONLY — one-off script. DO NOT use for the real waitlist blast.
 * ============================================================================
 * Sends a SINGLE copy of the waitlist launch email to a hardcoded test address
 * via Resend, using credentials from .env.local. The real blast is a separate
 * decision (likely a Resend broadcast, for unsubscribe handling) and must NOT
 * go through this script.
 *
 * Run:  npx tsx scripts/send-waitlist-test.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resend } from "resend";
import {
  buildWaitlistLaunchEmail,
  WAITLIST_LAUNCH_SUBJECT,
} from "../lib/email/waitlistLaunchEmail";

// Guardrail: this script will only ever send to this one address.
const TEST_RECIPIENT = "jordanpaulco@gmail.com";
const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

// Minimal .env.local loader (no dotenv dependency in this project).
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY missing from .env.local");
  }

  if (TEST_RECIPIENT !== "jordanpaulco@gmail.com") {
    throw new Error("Refusing to send: recipient is not the approved test address.");
  }

  const resend = new Resend(apiKey);
  const html = buildWaitlistLaunchEmail();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [TEST_RECIPIENT],
    subject: WAITLIST_LAUNCH_SUBJECT,
    html,
  });

  if (error) {
    console.error("Send failed:", error);
    process.exit(1);
  }

  console.log(`Sent test to ${TEST_RECIPIENT} — id: ${data?.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
