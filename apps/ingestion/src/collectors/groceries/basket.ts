export interface BasketItem {
  category: string;
  label: string;
  standardUnit: string;
  searchQueries: {
    woolworths: string;
    paknsave: string;
    newworld: string;
  };
  sizePatterns: RegExp[];
  /** Product name must match at least one of these to be included */
  includePatterns?: RegExp[];
  /** Product name matching any of these will be excluded (specialty, flavoured, etc.) */
  excludePatterns: RegExp[];
  priceRange: { min: number; max: number };
}

/**
 * Basket items aligned to Stats NZ "Food Price Index Selected Monthly
 * Weighted Average Prices" definitions for data continuity.
 *
 * Stats NZ series references:
 *   Milk:   CPIM.SAP0127 — "Milk - standard homogenised, 2 litres"
 *   Eggs:   CPIM.SAP0130 — "Eggs, dozen" (all types, not just free-range)
 *   Bread:  CPIM.SAP0149 — "Bread - white sliced loaf, 600g"
 *   Butter: CPIM.SAP0131 — "Butter - salted, 500g"
 *   Cheese: CPIM.SAP0129 — "Cheese - mild cheddar (supermarket only), 1kg"
 */

// Common exclusions for non-standard/specialty products
const SPECIALTY_MILK =
  /organic|flavour|chocolate|strawberry|banana|protein\+|calci|lacto.?free|zero.?lacto|a2\b|oat|soy|almond|coconut|rice|uht|long.?life|powder|lite\b|trim\b|light\b|fat.?free|slim|farmhouse/i;
const SPECIALTY_EGGS =
  /quail|duck|liquid|free.?flow|omega/i;
const SPECIALTY_BREAD =
  /sourdough|ciabatta|brioche|gluten.?free|low.?carb|rye|wholemeal|wheatmeal|wholegrain|multigrain|grain|ancient|keto|protein|wrap|pita|english.?muffin|bun|roll|high.?fibre|sandwich/i;
const SPECIALTY_BUTTER =
  /almond|peanut|cashew|spread|margarine|olive|garlic|herb|truffle|cultured|ghee|vegan/i;
const SPECIALTY_CHEESE =
  /cream.?cheese|brie|camembert|parmesan|feta|halloumi|mozzarella|gouda|edam|colby|vintage|aged|tasty|smoked|pepper|chili|cumin|cranberry|apricot|slice|shred|grate/i;

export const BASKET: BasketItem[] = [
  {
    // Stats NZ: "Milk - standard homogenised, 2 litres"
    // Full-fat standard milk only — no lite/trim/light variants
    category: "milk",
    label: "2L Standard Milk",
    standardUnit: "2L",
    searchQueries: {
      woolworths: "standard milk 2l",
      paknsave: "standard milk 2l",
      newworld: "standard milk 2l",
    },
    sizePatterns: [/\b2\s*l(itre)?s?\b/i, /\b2000\s*ml\b/i],
    includePatterns: [/standard|blue.?top|full.?cream|original|whole|homogenised/i],
    excludePatterns: [SPECIALTY_MILK],
    priceRange: { min: 3, max: 8 },
  },
  {
    // Stats NZ: "Eggs, dozen" — all types, not just free-range
    // Includes cage, colony, barn, free-range
    category: "eggs",
    label: "Dozen Eggs",
    standardUnit: "12 pack",
    searchQueries: {
      woolworths: "eggs 12 pack",
      paknsave: "eggs 12",
      newworld: "eggs 12",
    },
    sizePatterns: [/\b12\s*(pack|pk|s)?\b/i, /\bdozen\b/i],
    // No includePatterns — accept all egg types (matches Stats NZ)
    excludePatterns: [SPECIALTY_EGGS],
    priceRange: { min: 4, max: 16 },
  },
  {
    // Stats NZ: "Bread - white sliced loaf, 600g"
    // Strictly 600g only — not 700g
    category: "bread",
    label: "White Sliced Loaf 600g",
    standardUnit: "600g",
    searchQueries: {
      woolworths: "white bread 600g",
      paknsave: "white bread 600g",
      newworld: "white bread 600g",
    },
    sizePatterns: [/\b600\s*g\b/i],
    includePatterns: [/white/i],
    excludePatterns: [SPECIALTY_BREAD],
    priceRange: { min: 1, max: 5 },
  },
  {
    // Stats NZ: "Butter - salted, 500g"
    // Already aligned
    category: "butter",
    label: "500g Salted Butter",
    standardUnit: "500g",
    searchQueries: {
      woolworths: "salted butter 500g",
      paknsave: "butter salted 500g",
      newworld: "butter salted 500g",
    },
    sizePatterns: [/\b500\s*g\b/i],
    includePatterns: [/butter/i],
    excludePatterns: [SPECIALTY_BUTTER],
    priceRange: { min: 4, max: 15 },
  },
  {
    // Stats NZ: "Cheese - mild cheddar (supermarket only), 1kg"
    // Strictly mild cheddar — not colby, edam, tasty, etc.
    category: "cheese",
    label: "1kg Mild Cheddar",
    standardUnit: "1kg",
    searchQueries: {
      woolworths: "mild cheddar 1kg",
      paknsave: "mild cheddar 1kg",
      newworld: "mild cheddar 1kg",
    },
    sizePatterns: [/\b1\s*kg\b/i, /\b1000\s*g\b/i],
    includePatterns: [/mild/i],
    excludePatterns: [SPECIALTY_CHEESE],
    priceRange: { min: 8, max: 20 },
  },
];
