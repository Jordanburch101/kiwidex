"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitSponsorEnquiry } from "@/app/actions/sponsor";

const initialState = { success: false, error: "" };

export function SponsorForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitSponsorEnquiry,
    initialState
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
    <Dialog onOpenChange={setOpen} open={open}>
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
          <form action={formAction} className="grid gap-3" ref={formRef}>
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
              <p
                className="text-xs"
                style={{ color: "oklch(0.637 0.237 25.331)" }}
              >
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
