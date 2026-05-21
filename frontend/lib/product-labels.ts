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
  hit:         { ru: 'Хит',                  className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  new:         { ru: 'Новинка',              className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  sale:        { ru: 'Акция',                className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  recommended: { ru: 'Рекомендуем',          className: 'bg-violet-100 text-violet-700 hover:bg-violet-100' },
  seasonal:    { ru: 'Сезонное',             className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  limited:     { ru: 'Лимит. серия',         className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
};
