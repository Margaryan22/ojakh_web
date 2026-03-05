'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingBag, Receipt, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';
import type { OrderStatus } from '@/types';

type Period = 'week' | 'month' | 'all';

interface AnalyticsData {
  totalRevenue: number;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  avgCheck: number;
  byStatus: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
}

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Неделя',
  month: 'Месяц',
  all: 'Всё время',
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('month');

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['admin-analytics', period],
    queryFn: () =>
      api.get('/admin/analytics', { params: { period } }).then((r) => r.data),
  });

  const maxQty = data?.topProducts[0]?.qty ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Аналитика</h1>
        <div className="flex rounded-lg border overflow-hidden">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse bg-muted h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
              label="Выручка"
              value={formatPrice(data?.totalRevenue ?? 0)}
              bg="bg-green-50"
            />
            <MetricCard
              icon={<ShoppingBag className="h-5 w-5 text-blue-600" />}
              label="Заказов"
              value={String(data?.orderCount ?? 0)}
              bg="bg-blue-50"
            />
            <MetricCard
              icon={<Receipt className="h-5 w-5 text-purple-600" />}
              label="Средний чек"
              value={formatPrice(data?.avgCheck ?? 0)}
              bg="bg-purple-50"
            />
            <MetricCard
              icon={<XCircle className="h-5 w-5 text-red-500" />}
              label="Отменено"
              value={String(data?.cancelledCount ?? 0)}
              sub={`из ${data?.orderCount ?? 0}`}
              bg="bg-red-50"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top products */}
            <div className="rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-base">Топ-5 товаров</h2>
              {data?.topProducts.length ? (
                <div className="space-y-3">
                  {data.topProducts.map((p) => (
                    <div key={p.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate max-w-[60%]">{p.name}</span>
                        <span className="text-muted-foreground">
                          {p.qty} шт · {formatPrice(p.revenue)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round((p.qty / maxQty) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Нет данных за период</p>
              )}
            </div>

            {/* Orders by status */}
            <div className="rounded-xl border p-5 space-y-4">
              <h2 className="font-semibold text-base">Заказы по статусам</h2>
              {data?.byStatus && Object.keys(data.byStatus).length ? (
                <div className="space-y-2">
                  {Object.entries(data.byStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[status as OrderStatus] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {STATUS_LABELS[status as OrderStatus] ?? status}
                        </span>
                        <span className="text-sm font-semibold">{count}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Нет данных за период</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
