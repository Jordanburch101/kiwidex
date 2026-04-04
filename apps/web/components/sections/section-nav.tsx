"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/", label: "Dashboard" },
  { href: "/news", label: "News" },
] as const;

export function SectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex justify-center border-[#e5e0d5] border-t border-b-2 border-b-[#2a2520]">
      {SECTIONS.map(({ href, label }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            className={`relative px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] no-underline transition-colors ${
              isActive
                ? "font-semibold text-[#2a2520]"
                : "font-medium text-[#998] hover:text-[#2a2520]"
            }`}
            href={href}
            key={href}
          >
            {label}
            {isActive && (
              <span className="-bottom-[2px] absolute inset-x-0 h-[2px] bg-[#2a2520]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
