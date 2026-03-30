"use server";

import { Resend } from "resend";

interface SponsorFormState {
  error: string;
  success: boolean;
}

export async function submitSponsorEnquiry(
  _prev: SponsorFormState,
  formData: FormData
): Promise<SponsorFormState> {
  const name = formData.get("name")?.toString().trim();
  const business = formData.get("business")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const message = formData.get("message")?.toString().trim() ?? "";

  if (!(name && business && email)) {
    return { success: false, error: "Please fill in all required fields." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (message.length > 1000) {
    return { success: false, error: "Message must be under 1000 characters." };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[sponsor] RESEND_API_KEY not set");
    return {
      success: false,
      error: "Unable to send enquiry. Please try again later.",
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const toEmail = process.env.SPONSOR_CONTACT_EMAIL || "admin@example.com";

  const { error } = await resend.emails.send({
    from: "The Kiwidex <onboarding@resend.dev>",
    to: toEmail,
    subject: `Sponsorship Enquiry — ${business}`,
    html: [
      "<h2>New Sponsorship Enquiry</h2>",
      `<p><strong>Name:</strong> ${name}</p>`,
      `<p><strong>Business:</strong> ${business}</p>`,
      `<p><strong>Email:</strong> ${email}</p>`,
      message ? `<p><strong>Message:</strong> ${message}</p>` : "",
    ].join("\n"),
  });

  if (error) {
    console.error("[sponsor] Resend error:", error);
    return {
      success: false,
      error: "Unable to send enquiry. Please try again later.",
    };
  }

  return { success: true, error: "" };
}
