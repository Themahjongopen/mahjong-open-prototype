import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedTeachValues = ["regularly", "occasionally", "not_yet"];
const allowedReachValues = ["1_10", "11_25", "26_50", "50_plus"];
const allowedTimelineValues = ["asap", "1_3", "3_6", "exploring"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const full_name = body?.full_name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const phone = body?.phone?.trim();
    const proposed_city = body?.proposed_city?.trim();
    const socials = body?.socials?.trim() || null;
    const experience = body?.experience?.trim();
    const teaches_organize = body?.teaches_organize;
    const reach_estimate = body?.reach_estimate;
    const play_venues = Array.isArray(body?.play_venues) ? body.play_venues.filter((item: unknown) => typeof item === "string") : [];
    const motivation = body?.motivation?.trim();
    const desired_timeline = body?.desired_timeline || null;
    const notes = body?.notes?.trim() || null;

    if (!isNonEmptyString(full_name) || !isNonEmptyString(email) || !isNonEmptyString(phone) || !isNonEmptyString(proposed_city) || !isNonEmptyString(experience) || !isNonEmptyString(motivation)) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!allowedTeachValues.includes(teaches_organize)) {
      return NextResponse.json({ error: "Please select a valid teaching/organizing answer." }, { status: 400 });
    }

    if (!allowedReachValues.includes(reach_estimate)) {
      return NextResponse.json({ error: "Please select a valid player reach estimate." }, { status: 400 });
    }

    if (desired_timeline && !allowedTimelineValues.includes(desired_timeline)) {
      return NextResponse.json({ error: "Please select a valid timeline." }, { status: 400 });
    }

    const supabase: any = createAdminClient();

    if (!supabase) {
      console.error("Commissioner application failed because Supabase admin credentials are missing.");
      return NextResponse.json({ error: "Application service is unavailable right now." }, { status: 503 });
    }

    const { error: insertError } = await supabase.from("commissioner_applications").insert({
      full_name,
      email,
      phone,
      proposed_city,
      socials,
      experience,
      teaches_organize,
      reach_estimate,
      play_venues,
      motivation,
      desired_timeline,
      notes,
      status: "new",
      source: "website",
    });

    if (insertError) {
      console.error("Commissioner application insert failed", insertError);
      return NextResponse.json({ error: "Application could not be saved. Please try again." }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      try {
        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: ["themahjongopen@gmail.com"],
          replyTo: email,
          subject: `New city commissioner application — ${proposed_city}`,
          html: `<div><h2>New city commissioner application</h2><p><strong>Full name:</strong> ${full_name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Proposed city:</strong> ${proposed_city}</p><p><strong>Socials / website:</strong> ${socials || "Not provided"}</p><p><strong>Mahjong experience:</strong> ${experience}</p><p><strong>Teaches or organizes:</strong> ${teaches_organize}</p><p><strong>Reach estimate:</strong> ${reach_estimate}</p><p><strong>Where people usually play:</strong> ${play_venues.length ? play_venues.join(", ") : "Not provided"}</p><p><strong>Why they want to lead:</strong> ${motivation}</p><p><strong>Desired timeline:</strong> ${desired_timeline || "Not provided"}</p><p><strong>Notes:</strong> ${notes || "Not provided"}</p></div>`,
        });
      } catch (internalEmailError) {
        console.error("Internal commissioner application email failed", internalEmailError);
      }

      try {
        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: [email],
          subject: "Thanks for your interest in leading The Mahjong Open",
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2a44; line-height: 1.6;">
              <h2 style="color: #1f2a44; margin-bottom: 8px;">Thanks for your interest</h2>
              <p>Hi ${full_name},</p>
              <p>We’ve received your interest in leading The Mahjong Open in ${proposed_city}. Thanks for taking the time to share your background and ideas.</p>
              <p>We’ll be in touch soon about the next steps.</p>
              <p>Thanks,<br />The Mahjong Open</p>
            </div>
          `,
        });
      } catch (ackEmailError) {
        console.warn("Applicant acknowledgment email failed", ackEmailError);
      }
    } else {
      console.warn("Skipping commissioner application emails because RESEND_API_KEY is not configured.");
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
