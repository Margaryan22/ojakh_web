export const PRODUCT_LABEL_VALUES = [
  'hit',
  'new',
  'sale',
  'recommended',
  'seasonal',
  'limited',
] as const;

export type ProductLabel = (typeof PRODUCT_LABEL_VALUES)[number];
