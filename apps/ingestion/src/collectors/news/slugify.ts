const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function slugifyHeadline(headline: string, date: Date): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const month = MONTHS[date.getMonth()]!;
  const year = date.getFullYear();
  const suffix = `-${month}-${year}`;

  const maxBase = 80 - suffix.length;
  const truncated =
    base.length > maxBase
      ? base.slice(0, base.lastIndexOf("-", maxBase)).replace(/-$/, "")
      : base;

  return `${truncated}${suffix}`;
}
