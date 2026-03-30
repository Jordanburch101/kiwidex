# Sponsorship CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sponsorship CTA section above the footer that opens a contact form modal, sending enquiries via Resend.

**Architecture:** Server component section (`sponsor-cta.tsx`) renders the centred editorial layout. Client component (`sponsor-form.tsx`) manages the Dialog modal with a 4-field form. A Server Action validates and sends the enquiry email via Resend.

**Tech Stack:** Next.js 16 Server Actions, base-ui Dialog (via `@workspace/ui`), Resend SDK

---

## File Structure

| File | Type | Responsibility |
|------|------|---------------|
| `apps/web/app/actions/sponsor.ts` | Server Action | Validate form fields, send email via Resend |
| `apps/web/components/sponsor-form.tsx` | Client component | Dialog modal, form UI, submission state management |
| `apps/web/components/sections/sponsor-cta.tsx` | Server component | Centred editorial section layout |
| `apps/web/app/page.tsx` | Modified | Add `<SponsorCTA />` between CurrencyDeepDive and Footer |
| `apps/web/package.json` | Modified | Add `resend` dependency |

---

### Task 1: Add Resend dependency to web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install resend**

```bash
cd apps/web && bun add resend
```

- [ ] **Step 2: Verify it installed**

```bash
grep resend apps/web/package.json
```

Expected: `"resend": "^6.x.x"` in dependencies

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(web): add resend dependency for sponsor contact form"
```

---

### Task 2: Server Action — sponsor enquiry email

**Files:**
- Create: `apps/web/app/actions/sponsor.ts`

- [ ] **Step 1: Create the actions directory and server action**

Create `apps/web/app/actions/sponsor.ts`:

```typescript
"use server";

import { Resend } from "resend";

interface SponsorFormState {
  success: boolean;
  error: string;
}

export async function submitSponsorEnquiry(
  _prev: SponsorFormState,
  formData: FormData,
): Promise<SponsorFormState> {
  const name = formData.get("name")?.toString().trim();
  const business = formData.get("business")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const message = formData.get("message")?.toString().trim() ?? "";

  if (!name || !business || !email) {
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
    return { success: false, error: "Unable to send enquiry. Please try again later." };
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
    return { success: false, error: "Unable to send enquiry. Please try again later." };
  }

  return { success: true, error: "" };
}
```

- [ ] **Step 2: Run lint to verify**

```bash
bunx biome check --fix apps/web/app/actions/sponsor.ts
```

Expected: no errors (or auto-fixed)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/actions/sponsor.ts
git commit -m "feat(web): add server action for sponsor enquiry emails"
```

---

### Task 3: Sponsor form modal (client component)

**Files:**
- Create: `apps/web/components/sponsor-form.tsx`

This component uses the Dialog from `@workspace/ui` and `useActionState` from React 19 to manage form submission.

- [ ] **Step 1: Create the sponsor form component**

Create `apps/web/components/sponsor-form.tsx`:

```typescript
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { submitSponsorEnquiry } from "@/app/actions/sponsor";

const initialState = { success: false, error: "" };

export function SponsorForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitSponsorEnquiry,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="rounded-md bg-[#2a2520] px-6 py-2.5 font-medium text-[#faf9f6] text-xs tracking-wide transition-colors hover:bg-[#3d352e]"
        render={<button type="button" />}
      >
        Get in touch
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sponsorship Enquiry</DialogTitle>
          <DialogDescription>
            Interested in reaching NZ professionals? Tell us about your business
            and we'll be in touch.
          </DialogDescription>
        </DialogHeader>
        {state.success ? (
          <div className="py-6 text-center">
            <p className="font-medium text-[#2a2520] text-sm">
              Thank you for your interest!
            </p>
            <p className="mt-1 text-[#998] text-xs">
              We'll be in touch shortly.
            </p>
          </div>
        ) : (
          <form ref={formRef} action={formAction} className="grid gap-3">
            <input
              className="border border-[#d5d0c5] bg-[#faf9f6] px-3 py-2 text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520]"
              name="name"
              placeholder="Your name"
              required
              type="text"
            />
            <input
              className="border border-[#d5d0c5] bg-[#faf9f6] px-3 py-2 text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520]"
              name="business"
              placeholder="Business / Company"
              required
              type="text"
            />
            <input
              className="border border-[#d5d0c5] bg-[#faf9f6] px-3 py-2 text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520]"
              name="email"
              placeholder="Email address"
              required
              type="email"
            />
            <textarea
              className="min-h-[80px] resize-y border border-[#d5d0c5] bg-[#faf9f6] px-3 py-2 text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520]"
              maxLength={1000}
              name="message"
              placeholder="Tell us about your goals (optional)"
            />
            {state.error && (
              <p className="text-xs" style={{ color: "oklch(0.637 0.237 25.331)" }}>
                {state.error}
              </p>
            )}
            <button
              className="rounded-md bg-[#2a2520] px-5 py-2.5 font-medium text-[#faf9f6] text-xs tracking-wide transition-colors hover:bg-[#3d352e] disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending ? "Sending..." : "Send enquiry"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
bunx biome check --fix apps/web/components/sponsor-form.tsx
```

Expected: clean or auto-fixed

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sponsor-form.tsx
git commit -m "feat(web): add sponsor enquiry form modal"
```

---

### Task 4: Sponsor CTA section (server component)

**Files:**
- Create: `apps/web/components/sections/sponsor-cta.tsx`

- [ ] **Step 1: Create the section component**

Create `apps/web/components/sections/sponsor-cta.tsx`:

```typescript
import { SponsorForm } from "@/components/sponsor-form";

export function SponsorCTA() {
  return (
    <section className="px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 inline-block border-[#e5e0d5] border-b pb-1 font-semibold text-[#998] text-[9px] uppercase tracking-[0.25em]">
          Sponsorship
        </span>
        <h2 className="font-bold font-heading text-2xl text-[#2a2520]">
          Reach New Zealand's Economy Watchers
        </h2>
        <p className="mt-2 max-w-[420px] text-[#998] text-xs leading-relaxed">
          Thousands of professionals, investors, and decision-makers check this
          dashboard weekly. Put your brand where the data is.
        </p>
        <div className="mt-5">
          <SponsorForm />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
bunx biome check --fix apps/web/components/sections/sponsor-cta.tsx
```

Expected: clean or auto-fixed

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sections/sponsor-cta.tsx
git commit -m "feat(web): add sponsorship CTA section"
```

---

### Task 5: Wire into page layout

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Add import and render SponsorCTA between CurrencyDeepDive and Footer**

Add import at top of `apps/web/app/page.tsx`:

```typescript
import { SponsorCTA } from "@/components/sections/sponsor-cta";
```

Add the section between `CurrencyDeepDive` and `Footer`:

```tsx
        <div className="border-[#e5e0d5] border-t">
          <CurrencyDeepDive />
        </div>
        <div className="border-[#e5e0d5] border-t">
          <SponsorCTA />
        </div>
        <Footer />
```

- [ ] **Step 2: Run lint**

```bash
bunx biome check --fix apps/web/app/page.tsx
```

Expected: clean or auto-fixed

- [ ] **Step 3: Verify dev server renders the section**

```bash
cmux browser open http://localhost:3000
cmux browser snapshot
```

Expected: page loads with "Sponsorship" section visible above the footer

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): add sponsorship CTA to page layout"
```

---

### Task 6: Verify end-to-end

- [ ] **Step 1: Check the section renders**

```bash
cmux browser open http://localhost:3000
cmux browser snapshot --selector "section"
```

Look for: "Sponsorship" label, "Reach New Zealand's Economy Watchers" heading, "Get in touch" button

- [ ] **Step 2: Test the modal opens**

Click the "Get in touch" button and verify the dialog appears with 4 form fields.

- [ ] **Step 3: Test form validation**

Submit with empty fields — expect inline error "Please fill in all required fields." from the server action (browser native validation will also fire on required fields).

- [ ] **Step 4: Test submission (requires RESEND_API_KEY)**

If `RESEND_API_KEY` and `SPONSOR_CONTACT_EMAIL` are set in `.env.local`, fill in the form and submit. Verify:
- Button shows "Sending..."
- Success message appears: "Thank you for your interest!"
- Modal auto-closes after 3 seconds
- Email arrives at the configured address

If env vars are not set, the server action logs a warning and returns a user-friendly error.
