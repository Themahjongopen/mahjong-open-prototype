import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getPortalUser } from "@/lib/portal/session";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";

export const runtime = "nodejs";

const CATEGORIES: Record<string, string> = {
  login: "Signing in / my account",
  registration: "Registration or payment",
  tables: "Tables, seats, or scoring",
  standings: "Standings or stats look wrong",
  other: "Something else",
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = isNonEmptyString(body?.category) ? body.category.trim() : "";
  const message = isNonEmptyString(body?.message) ? body.message.trim() : "";

  if (!CATEGORIES[category]) {
    return NextResponse.json({ error: "Please choose what this is about." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Please give us a few more details (at least 10 characters)." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    // Local preview without email configured — don't block the submitter, but
    // don't pretend it was sent to a real inbox either.
    console.warn("Skipping support ticket email because RESEND_API_KEY is not configured.");
    return NextResponse.json({ ok: true });
  }

  const resend = new Resend(resendApiKey);
  const name = session.full_name || session.email;
  const cityLine = session.memberships.find((m) => m.city_id === session.city_id)?.city_name ?? "no city on file";
  const formattedMessage = message.replace(/\n/g, "<br />");

  const internalInnerHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;">
      <p style="margin:0 0 12px 0;"><strong>From:</strong> ${name} (${session.email})</p>
      <p style="margin:0 0 12px 0;"><strong>City:</strong> ${cityLine}</p>
      <p style="margin:0 0 12px 0;"><strong>Topic:</strong> ${CATEGORIES[category]}</p>
      <p style="margin:0;"><strong>Message:</strong><br />${formattedMessage}</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "The Mahjong Open <welcome@themahjongopen.com>",
      to: ["themahjongopen@gmail.com"],
      replyTo: session.email,
      subject: `Portal support request — ${name} (${CATEGORIES[category]})`,
      html: buildBrandedEmail({
        title: "New portal support request",
        innerHtml: internalInnerHtml,
        footerNote: "You're receiving this because a signed-in player submitted the portal's \"Get help\" form.",
      }),
    });
  } catch (err) {
    console.error("Support ticket email failed", err);
    return NextResponse.json({ error: "We couldn't send that just now — please try again in a minute." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
