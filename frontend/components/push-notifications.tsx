'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

// VAPID public key приходит в base64url — конвертируем в Uint8Array для subscribe.
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const { data } = await api.get('/push/public-key');
      if (!data.publicKey) {
        toast.error('Push-уведомления не настроены на сервере');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Разрешение на уведомления не выдано');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
      await api.post('/push/subscribe', sub.toJSON());
      setSubscribed(true);
      toast.success('Уведомления включены');
    } catch {
      toast.error('Не удалось включить уведомления');
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Уведомления выключены');
    } catch {
      toast.error('Не удалось выключить уведомления');
    } finally {
      setLoading(false);
    }
  };

  // На неподдерживаемых браузерах (в т.ч. iOS без «на экран Домой») просто скрываем.
  if (!supported) return null;

  return (
    <Button
      variant="outline"
      onClick={subscribed ? disable : enable}
      disabled={loading}
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {subscribed ? 'Выключить уведомления' : 'Включить push-уведомления'}
    </Button>
  );
}
