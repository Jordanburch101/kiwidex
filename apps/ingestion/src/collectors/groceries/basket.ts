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

// Common exclusions for non-standard/specialty products
const SPECIALTY_MILK = /organic|flavour|chocolate|strawberry|banana|protein\+|calci|lacto.?free|zero.?lacto|a2\b|oat|soy|almond|coconut|rice|uht|long.?life|powder/i;
const SPECIALTY_EGGS = /quail|duck|liquid|free.?flow|organic|omega|barn/i;
const SPECIALTY_BREAD = /sourdough|ciabatta|brioche|gluten.?free|low.?carb|rye|wholemeal|wheatmeal|wholegrain|multigrain|grain|ancient|keto|protein|wrap|pita|english.?muffin|bun|roll|high.?fibre/i;
const SPECIALTY_BUTTER = /almond|peanut|cashew|spread|margarine|olive|garlic|herb|truffle|cultured|ghee|vegan/i;
const SPECIALTY_CHEESE = /cream.?cheese|brie|camembert|parmesan|feta|halloumi|mozzarella|gouda|vintage|aged|smoked|pepper|chili|cumin|cranberry|apricot|slice|shred|grate/i;

export const BASKET: BasketItem[] = [
  {
    category: "milk",
    label: "2L Standard Blue Top Milk",
    standardUnit: "2L",
    searchQueries: {
      woolworths: "standard blue milk 2l",
      paknsave: "standard milk 2l",
      newworld: "standard milk 2l",
    },
    sizePatterns: [/\b2\s*l(itre)?s?\b/i, /\b2000\s*ml\b/i],
    includePatterns: [/standard|blue.?top|full.?cream|original|whole|lite\b|trim\b|light\b/i],
    excludePatterns: [SPECIALTY_MILK],
    priceRange: { min: 3, max: 8 },
  },
  {
    category: "eggs",
    label: "Dozen Free Range Eggs (Size 7)",
    standardUnit: "12 pack",
    searchQueries: {
      woolworths: "free range eggs size 7 12",
      paknsave: "free range eggs 12",
      newworld: "free range eggs 12",
    },
    sizePatterns: [/\b12\s*(pack|pk|s)?\b/i, /\bdozen\b/i],
    includePatterns: [/free.?range/i],
    excludePatterns: [SPECIALTY_EGGS],
    priceRange: { min: 5, max: 16 },
  },
  {
    category: "bread",
    label: "White Toast Loaf (600-700g)",
    standardUnit: "700g",
    searchQueries: {
      woolworths: "white toast bread",
      paknsave: "toast white bread",
      newworld: "toast white bread",
    },
    sizePatterns: [/\b700\s*g\b/i, /\b600\s*g\b/i],
    includePatterns: [/toast|white/i],
    excludePatterns: [SPECIALTY_BREAD],
    priceRange: { min: 1.50, max: 7 },
  },
  {
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
    priceRange: { min: 4, max: 12 },
  },
  {
    category: "cheese",
    label: "1kg Mild Cheese Block",
    standardUnit: "1kg",
    searchQueries: {
      woolworths: "mild cheese block 1kg",
      paknsave: "mild cheese 1kg",
      newworld: "mild cheese 1kg",
    },
    sizePatterns: [/\b1\s*kg\b/i, /\b1000\s*g\b/i],
    includePatterns: [/mild|colby|cheddar|edam|tasty/i],
    excludePatterns: [SPECIALTY_CHEESE],
    priceRange: { min: 8, max: 22 },
  },
];
