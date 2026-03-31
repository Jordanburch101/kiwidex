/**
 * Known NZ grocery brands. Used to extract brand from product names.
 * Listed longest-first so multi-word brands match before single-word ones.
 */
const KNOWN_BRANDS = [
  "Lewis Road Creamery",
  "Lewis Road",
  "Meadow Fresh",
  "Nature's Fresh",
  "Tip Top",
  "Bobby's",
  "Anchor",
  "Mainland",
  "Pams",
  "Value",
  "Homebrand",
  "Woodland",
  "Countdown",
  "Macro",
  "Kapiti",
  "Zany Zeus",
  "Fonterra",
  "Tatua",
  "NZ Farmers",
  "Alpine",
  "Devondale",
  "Western Star",
  "Perfect Italiano",
  "Lurpak",
  "Président",
  "President",
  "Bürgen",
  "Burgen",
  "Vogel's",
  "Vogels",
  "Freya's",
  "Freyas",
  "Molenberg",
  "Ploughmans",
  "Wonder White",
  "Earnest",
  "Pics",
  "Pic's",
  "Egg Producers",
  "Farmer Brown",
  "Henergy",
  "Zeagold",
];

/**
 * Extract brand name from a product name string.
 * Checks known brands first, then falls back to the first word.
 */
export function extractBrand(productName: string): string {
  const nameLower = productName.toLowerCase();

  for (const brand of KNOWN_BRANDS) {
    if (nameLower.startsWith(brand.toLowerCase())) {
      return brand;
    }
  }

  // Also check if the brand appears anywhere in the name (for cases like "Value Milk 2L")
  for (const brand of KNOWN_BRANDS) {
    if (nameLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  // Fallback: first word of the product name
  const firstWord = productName.split(/\s+/)[0];
  return firstWord ?? "Unknown";
}
