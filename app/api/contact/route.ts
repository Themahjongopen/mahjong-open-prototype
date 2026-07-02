import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";

export const runtime = "nodejs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const first = body?.first?.trim();
    const last = body?.last?.trim();
    const email = body?.email?.trim().toLowerCase();
    const subject = body?.subject?.trim();
    const message = body?.message?.trim();

    const fullName = `${first ?? ""} ${last ?? ""}`.trim();

    if (!isNonEmptyString(fullName) || !isNonEmptyString(email) || !isNonEmptyString(message)) {
      return NextResponse.json({ error: "Please complete your name, email, and message." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const SITE_URL = "https://themahjongopen.com";
      const firstName = first || "there";
      const formattedMessage = message.replace(/\n/g, "<br />");

      const internalInnerHtml = `
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;">
          <p style="margin:0 0 12px 0;"><strong>Name:</strong> ${fullName}</p>
          <p style="margin:0 0 12px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0 0 12px 0;"><strong>Subject:</strong> ${subject || "Not provided"}</p>
          <p style="margin:0;"><strong>Message:</strong><br />${formattedMessage}</p>
        </div>
      `;

      const autoReplyInnerHtml = `
        <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
        <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Thanks for reaching out — we&rsquo;ve got your message and someone from The Mahjong Open will get back to you soon.</p>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">In the meantime, feel free to explore how it works or register for the current series.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
          <tr>
            <td align="center" style="background-color:#ec466e;border-radius:999px;">
              <a href="${SITE_URL}/how-it-works" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">How it works</a>
            </td>
          </tr>
        </table>
      `;

      try {
        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: ["themahjongopen@gmail.com"],
          replyTo: email,
          subject: `New contact message — ${fullName}`,
          html: buildBrandedEmail({
            title: "New contact message",
            innerHtml: internalInnerHtml,
            footerNote: "A city-based mahjong social league. You’re receiving this because someone submitted a contact form through The Mahjong Open.",
          }),
        });
      } catch (internalEmailError) {
        console.error("Internal contact email failed", internalEmailError);
      }

      try {
        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: [email],
          subject: "Thanks for reaching out to The Mahjong Open",
          html: buildBrandedEmail({
            title: "Thanks for reaching out",
            innerHtml: autoReplyInnerHtml,
            footerNote: "A city-based mahjong social league. You’re receiving this because you contacted The Mahjong Open.",
          }),
        });
      } catch (autoReplyError) {
        console.error("Contact auto-reply failed", autoReplyError);
      }
    } else {
      console.warn("Skipping contact emails because RESEND_API_KEY is not configured.");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function PATCH() {
  return NextResponse.json({ ok: true });
}
