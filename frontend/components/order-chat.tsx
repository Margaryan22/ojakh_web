'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { OrderMessage } from '@/types';

interface OrderChatProps {
  orderId: number;
  role: 'user' | 'admin';
}

const MAX_LEN = 2000;
const POLL_MS = 3000;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSep(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

export function OrderChat({ orderId, role }: OrderChatProps) {
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const prevCountRef = useRef(0);

  const { data: messages = [], isLoading } = useQuery<OrderMessage[]>({
    queryKey: ['order-messages', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/messages`);
      return data;
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  // Авто-скролл вниз при появлении новых сообщений
  useEffect(() => {
    if (messages.length === prevCountRef.current) return;
    prevCountRef.current = messages.length;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Сбрасываем счётчики непрочитанных в админке после открытия чата
  useEffect(() => {
    if (role === 'admin' && messages.length > 0) {
      qc.invalidateQueries({ queryKey: ['admin-unread-summary'] });
    }
  }, [role, messages.length, qc]);

  const sendMutation = useMutation({
    mutationFn: async (payload: string) => {
      const { data } = await api.post<OrderMessage>(
        `/orders/${orderId}/messages`,
        { text: payload },
      );
      return data;
    },
    onSuccess: (msg) => {
      qc.setQueryData<OrderMessage[]>(
        ['order-messages', orderId],
        (prev = []) => [...prev, msg],
      );
      setText('');
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        toast.error(err.response?.data?.message ?? 'Не удалось отправить');
      } else {
        toast.error('Не удалось отправить');
      }
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LEN) {
      toast.error(`Слишком длинное сообщение (макс ${MAX_LEN})`);
      return;
    }
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {role === 'admin' ? 'Чат с клиентом' : 'Чат с администратором'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-80 min-h-32 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-2"
        >
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-10 w-1/2 ml-auto" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {role === 'admin'
                ? 'Сообщений пока нет. Напишите клиенту первым.'
                : 'Напишите администратору — мы ответим как можно скорее.'}
            </p>
          ) : (
            messages.map((m, i) => {
              const isMine = m.senderRole === role;
              const prev = messages[i - 1];
              const showDateSep =
                !prev ||
                new Date(prev.createdAt).toDateString() !==
                  new Date(m.createdAt).toDateString();
              return (
                <div key={m.id} className="space-y-1.5">
                  {showDateSep && (
                    <div className="text-[10px] text-muted-foreground text-center py-1">
                      {formatDateSep(m.createdAt)}
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex',
                      isMine ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words',
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-background border rounded-bl-sm',
                      )}
                    >
                      <div>{m.text}</div>
                      <div
                        className={cn(
                          'text-[10px] mt-0.5 text-right',
                          isMine
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={handleKeyDown}
            placeholder={
              role === 'admin'
                ? 'Ответ клиенту...'
                : 'Сообщение администратору...'
            }
            rows={2}
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            disabled={sendMutation.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {text.length > MAX_LEN * 0.8 && (
          <p className="text-[10px] text-muted-foreground text-right">
            {text.length} / {MAX_LEN}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
