"use client";

export function NewsletterForm() {
  return (
    <form
      className="flex w-full shrink-0 sm:w-auto"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        className="w-full border border-[#d5d0c5] border-r-0 bg-[#faf9f6] px-4 py-2.5 font-sans text-[#2a2520] text-xs outline-none placeholder:text-[#bbb] focus:border-[#2a2520] sm:w-60"
        placeholder="your@email.co.nz"
        type="email"
      />
      <button
        className="shrink-0 border border-[#2a2520] bg-[#2a2520] px-5 py-2.5 font-semibold text-[#faf9f6] text-[10px] uppercase tracking-[0.15em] transition-colors hover:bg-transparent hover:text-[#2a2520]"
        type="submit"
      >
        Subscribe
      </button>
    </form>
  );
}
