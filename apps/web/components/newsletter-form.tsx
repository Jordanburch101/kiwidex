"use client";

import { subscribeNewsletter } from "@/app/actions/newsletter";
import { useActionState } from "react";

export function NewsletterForm() {
  const [state, action, pending] = useActionState(subscribeNewsletter, {
    error: "",
    success: false,
  });

  if (state.success) {
    return (
      <p className="font-sans text-xs text-[#2a2520]">
        You&apos;re subscribed — thanks!
      </p>
    );
  }

  return (
    <form action={action} className="flex w-full shrink-0 flex-col sm:w-auto">
      <div className="flex">
        <input
          className="w-full border border-[#d5d0c5] border-r-0 bg-[#faf9f6] px-4 py-2.5 font-sans text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520] sm:w-60"
          name="email"
          placeholder="your@email.co.nz"
          type="email"
          required
        />
        <button
          className="shrink-0 border border-[#2a2520] bg-[#2a2520] px-5 py-2.5 font-semibold text-[#faf9f6] text-[10px] uppercase tracking-[0.15em] transition-colors hover:bg-transparent hover:text-[#2a2520] disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "…" : "Subscribe"}
        </button>
      </div>
      {state.error && (
        <p className="mt-1.5 font-sans text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
