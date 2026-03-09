'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DayCalendar {
  date: string;
  unitCount: number;
  tortCount: number;
  maxUnits: number;
  maxTorts: number;
  available: boolean;
}

export default function AdminCalendarPage() {
  const { data: capacities = [], isLoading } = useQuery<DayCalendar[]>({
    queryKey: ['admin-calendar'],
    queryFn: async () => {
      const { data } = await api.get('/admin/calendar?days=14');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Календарь нагрузки</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {capacities.map((day) => {
          const unitsAtLimit = day.unitCount >= day.maxUnits;
          const tortsAtLimit = day.tortCount >= day.maxTorts;

          let colorClass = 'border-green-200 bg-green-50';
          if (unitsAtLimit && tortsAtLimit) {
            colorClass = 'border-red-300 bg-red-50';
          } else if (unitsAtLimit || tortsAtLimit) {
            colorClass = 'border-yellow-300 bg-yellow-50';
          }

          return (
            <Card key={day.date} className={cn('overflow-hidden', colorClass)}>
              <CardContent className="p-3 text-center space-y-1">
                <p className="font-semibold text-sm">{formatDate(day.date)}</p>
                <div className="text-xs space-y-0.5">
                  <p>
                    Единиц:{' '}
                    <span className="font-medium">
                      {day.unitCount} / {day.maxUnits}
                    </span>
                  </p>
                  <p>
                    Торты:{' '}
                    <span className="font-medium">
                      {day.tortCount} / {day.maxTorts}
                    </span>
                  </p>
                </div>
                {!day.available && (
                  <p className="text-[10px] text-red-600 font-medium">Заполнено</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          Доступно
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          Один лимит заполнен
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          Заполнено
        </div>
      </div>
    </div>
  );
}
