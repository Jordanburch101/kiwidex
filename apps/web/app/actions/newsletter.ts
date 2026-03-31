"use server";

import { Resend } from "resend";

const AUDIENCE_ID = "559dc36c-5eaf-4f62-80c4-041cf4d337f2";

interface NewsletterFormState {
  error: string;
  success: boolean;
}

export async function subscribeNewsletter(
  _prev: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const email = formData.get("email")?.toString().trim();

  if (!email) {
    return { success: false, error: "Please enter your email address." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("[newsletter] RESEND_API_KEY not set");
    return {
      success: false,
      error: "Unable to subscribe. Please try again later.",
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.contacts.create({
    audienceId: AUDIENCE_ID,
    email,
  });

  if (error) {
    console.error("[newsletter] Resend error:", error);
    return {
      success: false,
      error: "Unable to subscribe. Please try again later.",
    };
  }

  return { success: true, error: "" };
}
