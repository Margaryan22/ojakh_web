import type { Product } from '@/types';

interface NutritionInfoProps {
  product: Pick<Product, 'calories' | 'protein' | 'fat' | 'carbs' | 'weightGrams'>;
}

const formatNumber = (n: number) => {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
};

export function NutritionInfo({ product }: NutritionInfoProps) {
  const rows: Array<[string, string]> = [
    ['Энерг. ценность', `${formatNumber(product.calories)} ккал`],
    ['Белки', `${formatNumber(product.protein)} г`],
    ['Жиры', `${formatNumber(product.fat)} г`],
    ['Углеводы', `${formatNumber(product.carbs)} г`],
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Пищевая ценность на 100 г</p>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
          </div>
        ))}
        {product.weightGrams != null && (
          <div className="flex items-center justify-between text-sm border-t pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Вес</span>
            <span className="font-medium tabular-nums">{product.weightGrams} г</span>
          </div>
        )}
      </div>
    </div>
  );
}
