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
  priceRange: { min: number; max: number };
}

export const BASKET: BasketItem[] = [
  {
    category: "milk",
    label: "2L Standard Milk",
    standardUnit: "2L",
    searchQueries: {
      woolworths: "milk standard 2l",
      paknsave: "milk 2l",
      newworld: "milk 2l",
    },
    sizePatterns: [/\b2\s*l(itre)?s?\b/i, /\b2000\s*ml\b/i],
    priceRange: { min: 2, max: 10 },
  },
  {
    category: "eggs",
    label: "Dozen Free Range Eggs",
    standardUnit: "12 pack",
    searchQueries: {
      woolworths: "free range eggs 12",
      paknsave: "free range eggs 12",
      newworld: "free range eggs 12",
    },
    sizePatterns: [/\b12\s*(pack|pk|s)?\b/i, /\bdozen\b/i],
    priceRange: { min: 4, max: 18 },
  },
  {
    category: "bread",
    label: "White Toast Loaf",
    standardUnit: "700g",
    searchQueries: {
      woolworths: "white toast bread 700g",
      paknsave: "toast white bread",
      newworld: "toast white bread",
    },
    sizePatterns: [/\b700\s*g\b/i, /\b600\s*g\b/i],
    priceRange: { min: 1, max: 8 },
  },
  {
    category: "butter",
    label: "500g Butter",
    standardUnit: "500g",
    searchQueries: {
      woolworths: "butter 500g",
      paknsave: "butter 500g",
      newworld: "butter 500g",
    },
    sizePatterns: [/\b500\s*g\b/i],
    priceRange: { min: 3, max: 14 },
  },
  {
    category: "cheese",
    label: "1kg Mild/Colby Cheese",
    standardUnit: "1kg",
    searchQueries: {
      woolworths: "mild cheese 1kg",
      paknsave: "mild cheese 1kg",
      newworld: "mild cheese 1kg",
    },
    sizePatterns: [/\b1\s*kg\b/i, /\b1000\s*g\b/i],
    priceRange: { min: 8, max: 25 },
  },
];
