# Sponsorship CTA Section

**Date:** 2026-03-30
**Status:** Approved

## Overview

A sponsorship call-to-action section placed above the footer, inviting businesses to enquire about advertising on the The Kiwidex dashboard. Clicking the CTA opens a contact form modal that sends enquiries via Resend.

## Placement

New `<SponsorCTA />` component in `page.tsx`, rendered between `<CurrencyDeepDive />` and `<Footer />`. Wrapped in a `<div className="border-[#e5e0d5] border-t">` to match the deep-dive section separators.

## Visual Design — Centred Editorial (Option A)

- **Section padding**: `px-6 py-10` (matches deep-dive sections)
- **Label**: "SPONSORSHIP" — uppercase 9px, letter-spacing 0.25em, muted colour (#998), inline border-bottom. Matches the footer section header style.
- **Heading**: Playfair Display (font-heading), bold, ~22px, colour #2a2520. Text: "Reach New Zealand's Economy Watchers"
- **Pitch**: 12px muted text (#998), max-width ~420px, centred. Text: "Thousands of professionals, investors, and decision-makers check this dashboard weekly. Put your brand where the data is."
- **CTA button**: Dark background (#2a2520), light text (#faf9f6), 12px font-weight-500, rounded-md, padding 9px 24px. Text: "Get in touch"
- **Layout**: Everything centred, vertically stacked with appropriate spacing

## Contact Form Modal

Uses shadcn `Dialog` component from `@workspace/ui`.

### Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text input | Yes | Non-empty |
| Business / Company | text input | Yes | Non-empty |
| Email | email input | Yes | Valid email format |
| Message | textarea | No | Max 1000 chars |

### Behaviour

- Opens when "Get in touch" button is clicked
- Submit button text: "Send enquiry"
- On submit: calls a Server Action, shows loading state on button
- On success: form replaced with thank-you message, modal auto-closes after 3 seconds
- On error: inline error message below the form

## Technical Implementation

### Files

| File | Type | Purpose |
|------|------|---------|
| `apps/web/components/sections/sponsor-cta.tsx` | Server component | Section layout with heading, pitch, and trigger button |
| `apps/web/components/sponsor-form.tsx` | Client component ("use client") | Dialog modal with form, submission handling |
| `apps/web/app/actions/sponsor.ts` | Server Action ("use server") | Validates form data, sends email via Resend |
| `apps/web/app/page.tsx` | Modified | Add `<SponsorCTA />` between CurrencyDeepDive and Footer |

### Dependencies

- Add `resend` to `apps/web/package.json` (already in `apps/ingestion`)
- shadcn `Dialog` component — check if already in `@workspace/ui`, add if not

### Environment Variables

- `RESEND_API_KEY` — Resend API key (may already exist for ingestion service)
- `SPONSOR_CONTACT_EMAIL` — destination email for sponsor enquiries

### Server Action (`apps/web/app/actions/sponsor.ts`)

```
"use server"
- Accept: { name, business, email, message }
- Validate required fields + email format
- Send via Resend:
  - From: "The Kiwidex <noreply@resend.dev>" (or project's verified domain if configured)
  - To: process.env.SPONSOR_CONTACT_EMAIL
  - Subject: "Sponsorship Enquiry — {business}"
  - Body: formatted with all form fields
- Return: { success: true } or { error: string }
```

### Form Component (`apps/web/components/sponsor-form.tsx`)

- "use client" — manages dialog open/close state and form submission
- Uses `useActionState` for the Server Action
- Loading state on submit button
- Success state: "Thank you for your interest! We'll be in touch shortly." — auto-closes modal after 3s via `setTimeout`
- Error state: inline message below form

## Out of Scope

- Spam prevention (honeypot, rate limiting) — can be added later if needed
- Storing enquiries in the database — email-only for now
- Sponsor logo display — this is a CTA for attracting sponsors, not displaying them
