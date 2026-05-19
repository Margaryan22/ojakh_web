export const PRODUCT_LABEL_VALUES = [
  'hit',
  'new',
  'sale',
  'recommended',
  'seasonal',
  'limited',
] as const;

export type ProductLabel = (typeof PRODUCT_LABEL_VALUES)[number];

export const PRODUCT_LABELS: Record<
  ProductLabel,
  { ru: string; className: string }
> = {
  hit:         { ru: 'Хит',                  className: 'bg-orange-500 text-white hover:bg-orange-500' },
  new:         { ru: 'Новинка',              className: 'bg-emerald-500 text-white hover:bg-emerald-500' },
  sale:        { ru: 'Акция',                className: 'bg-red-500 text-white hover:bg-red-500' },
  recommended: { ru: 'Рекомендуем',          className: 'bg-violet-500 text-white hover:bg-violet-500' },
  seasonal:    { ru: 'Сезонное',             className: 'bg-amber-500 text-white hover:bg-amber-500' },
  limited:     { ru: 'Лимит. серия',         className: 'bg-yellow-600 text-white hover:bg-yellow-600' },
};
