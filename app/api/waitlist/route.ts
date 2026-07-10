import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Honeypot (same hidden `website` field as the contact form): silently accept, no insert.
    if (body?.website) {
      return NextResponse.json({ ok: true });
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase: any = createAdminClient();
    if (!supabase) {
      console.error("Waitlist signup failed because Supabase admin credentials are missing.");
      return NextResponse.json({ error: "The waitlist is unavailable right now." }, { status: 503 });
    }

    // Dedupe: insert ... on conflict (email) do nothing. .select() returns the
    // new row on insert and nothing when the email already existed, so we can
    // notify only on genuinely new signups. Never reveal dupes to the client.
    const { data: inserted, error: insertError } = await supabase
      .from("waitlist")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
      .select("id");

    if (insertError) {
      console.error("Waitlist insert failed", insertError);
      return NextResponse.json({ error: "Could not save your email. Please try again." }, { status: 500 });
    }

    const isNewSignup = Array.isArray(inserted) && inserted.length > 0;

    // Internal notice on genuinely new signups only. Non-fatal.
    const resendApiKey = process.env.RESEND_API_KEY;
    if (isNewSignup && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: ["themahjongopen@gmail.com"],
          replyTo: email,
          subject: `New waitlist signup — ${email}`,
          html: buildBrandedEmail({
            title: "New waitlist signup",
            innerHtml: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;"><p style="margin:0;"><strong>Email:</strong> ${email}</p></div>`,
            footerNote: "A city-based mahjong social league. You’re receiving this because someone joined the waitlist on The Mahjong Open.",
          }),
        });
      } catch (emailError) {
        console.error("Waitlist internal notice email failed", emailError);
      }
    } else if (isNewSignup) {
      console.warn("Skipping waitlist notice email because RESEND_API_KEY is not configured.");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
