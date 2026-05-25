'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  HelpCircle,
  AlertCircle,
  Heart,
  CheckCircle2,
  MessageSquare,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn } from '@/components/motion/fade-in';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { Feedback, FeedbackKind, FeedbackListResponse } from '@/types';

const KIND_META: Record<
  FeedbackKind,
  { label: string; Icon: typeof Sparkles; className: string }
> = {
  idea: {
    label: 'Идея',
    Icon: Sparkles,
    className: 'bg-accent text-accent-foreground border-accent-foreground/20',
  },
  question: {
    label: 'Вопрос',
    Icon: HelpCircle,
    className: 'bg-info-bg text-info border-info/20',
  },
  complaint: {
    label: 'Жалоба',
    Icon: AlertCircle,
    className: 'bg-error-bg text-error border-error-border',
  },
  praise: {
    label: 'Похвала',
    Icon: Heart,
    className: 'bg-success-bg text-success border-success-border',
  },
};

const PAGE_SIZE = 20;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminFeedbackPage() {
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<FeedbackListResponse>({
    queryKey: ['admin-feedback', unreadOnly, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        unreadOnly: String(unreadOnly),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const { data } = await api.get(`/admin/feedback?${params.toString()}`);
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/feedback/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-unread'] });
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        toast.error(err.response?.data?.message ?? 'Не удалось сохранить');
      } else {
        toast.error('Не удалось сохранить');
      }
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + items.length < total;

  return (
    <FadeIn>
      <div className='space-y-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold flex items-center gap-2'>
              <MessageSquare className='h-6 w-6 text-primary' />
              Обратная связь
            </h1>
            <p className='text-sm text-muted-foreground mt-1'>
              Сообщения от посетителей сайта — идеи, вопросы, жалобы и похвала.
            </p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant={unreadOnly ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setOffset(0);
                setUnreadOnly(true);
              }}
            >
              Непрочитанные
            </Button>
            <Button
              variant={!unreadOnly ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setOffset(0);
                setUnreadOnly(false);
              }}
            >
              Все
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-28 w-full' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='text-center py-16 text-muted-foreground'>
            {unreadOnly ? 'Нет непрочитанных сообщений.' : 'Пока никто ничего не написал.'}
          </div>
        ) : (
          <div className='space-y-3'>
            {items.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                onMarkRead={() => markRead.mutate(item.id)}
                isPending={markRead.isPending && markRead.variables === item.id}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className='flex justify-center'>
            <Button
              variant='outline'
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={isFetching}
            >
              {isFetching ? 'Загрузка…' : 'Загрузить ещё'}
            </Button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}

interface FeedbackCardProps {
  item: Feedback;
  onMarkRead: () => void;
  isPending: boolean;
}

function FeedbackCard({ item, onMarkRead, isPending }: FeedbackCardProps) {
  const meta = KIND_META[item.kind];
  const Icon = meta.Icon;
  const isUnread = !item.readAt;

  return (
    <Card className={cn(isUnread && 'border-primary/50 ring-1 ring-primary/20')}>
      <CardContent className='p-4 space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-2 min-w-0'>
            <Badge variant='outline' className={cn('gap-1', meta.className)}>
              <Icon className='h-3 w-3' />
              {meta.label}
            </Badge>
            <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
              <UserRound className='h-3 w-3' />
              {item.user
                ? `${item.user.name} · ${item.user.email}`
                : 'Гость'}
            </span>
            <span className='text-xs text-muted-foreground'>
              · {formatWhen(item.createdAt)}
            </span>
          </div>
          {isUnread ? (
            <Button
              size='sm'
              variant='ghost'
              onClick={onMarkRead}
              disabled={isPending}
              className='gap-1 shrink-0'
            >
              <CheckCircle2 className='h-4 w-4' />
              Прочитано
            </Button>
          ) : (
            <span className='inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0'>
              <CheckCircle2 className='h-3.5 w-3.5 text-success' />
              {item.readAt && formatWhen(item.readAt)}
            </span>
          )}
        </div>
        <p className='text-sm whitespace-pre-wrap break-words'>{item.text}</p>
      </CardContent>
    </Card>
  );
}
