'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/auth.store';
import { FadeIn } from '@/components/motion/fade-in';
import api from '@/lib/api';
import type { AddressSuggestion, BuildingInfo, UserAddress } from '@/types';

const MAX_ADDRESSES = 5;

type FormState = {
  label: string;
  address: string;
  lat: number | null;
  lon: number | null;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  notes: string;
};

const emptyForm: FormState = {
  label: '',
  address: '',
  lat: null,
  lon: null,
  apartment: '',
  entrance: '',
  floor: '',
  intercom: '',
  notes: '',
};

const sanitizeDigits = (v: string, max = 3) => v.replace(/\D/g, '').slice(0, max);
const sanitizeFloor = (v: string) => {
  const m = v.match(/^-?\d{0,3}/);
  return m ? m[0] : '';
};
const sanitizeApartment = (v: string) =>
  v.replace(/[^0-9A-Za-zА-Яа-я\s\-\/]/g, '').slice(0, 20);
const sanitizeIntercom = (v: string) =>
  v.replace(/[^0-9A-Za-zА-Яа-я*#\-\s]/g, '').slice(0, 50);

function describeApartmentRanges(info: BuildingInfo | null): string | null {
  if (!info?.apartmentRanges?.length) return null;
  const compact = info.apartmentRanges
    .slice(0, 3)
    .map((r) => `${r.from}–${r.to}`)
    .join(', ');
  const more =
    info.apartmentRanges.length > 3
      ? ` и ещё ${info.apartmentRanges.length - 3}`
      : '';
  return `Квартиры: ${compact}${more}`;
}

function isApartmentInBuilding(
  apt: string,
  info: BuildingInfo | null,
): boolean {
  if (!info?.apartmentRanges?.length) return true;
  const digits = apt.replace(/\D/g, '');
  if (!digits) return true;
  const n = parseInt(digits, 10);
  return info.apartmentRanges.some((r) => n >= r.from && n <= r.to);
}

export default function AddressesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressValidated, setAddressValidated] = useState(false);
  const [buildingInfo, setBuildingInfo] = useState<BuildingInfo | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: addresses, isLoading } = useQuery<UserAddress[]>({
    queryKey: ['savedAddresses'],
    queryFn: async () => {
      const { data } = await api.get('/addresses');
      return data;
    },
    enabled: !!user,
  });

  // DaData suggestions (via backend proxy, key stays on the server)
  useEffect(() => {
    if (!isAdding && editingId == null) return;
    if (addressValidated) return;
    if (form.address.trim().length < 5) {
      setSuggestions([]);
      return;
    }
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/delivery/suggest-address', {
          params: { q: form.address },
        });
        setSuggestions(data.suggestions ?? []);
      } catch {
        // ignore suggestion errors
      }
    }, 400);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [form.address, addressValidated, isAdding, editingId]);

  // Fetch building-info from 2GIS as soon as address is validated.
  const fetchBuildingInfo = async (
    address: string,
    lat: number | null,
    lon: number | null,
  ) => {
    try {
      const params: Record<string, string> = { address };
      if (lat != null) params.lat = String(lat);
      if (lon != null) params.lon = String(lon);
      const { data } = await api.get('/delivery/building-info', { params });
      setBuildingInfo(data ?? null);
    } catch {
      setBuildingInfo(null);
    }
  };

  if (!isInitialized) {
    return (
      <div className='max-w-lg mx-auto space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-32 w-full rounded-xl' />
      </div>
    );
  }

  if (!user) {
    router.push('/login?next=/profile/addresses');
    return null;
  }

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setAddressValidated(false);
    setBuildingInfo(null);
    setSuggestions([]);
    setIsAdding(true);
  };

  const startEdit = (a: UserAddress) => {
    setIsAdding(false);
    setEditingId(a.id);
    setForm({
      label: a.label ?? '',
      address: a.address,
      lat: a.lat,
      lon: a.lon,
      apartment: a.apartment ?? '',
      entrance: a.entrance ?? '',
      floor: a.floor ?? '',
      intercom: a.intercom ?? '',
      notes: a.notes ?? '',
    });
    setSuggestions([]);
    const validated = a.lat != null && a.lon != null;
    setAddressValidated(validated);
    setBuildingInfo(null);
    if (validated) fetchBuildingInfo(a.address, a.lat, a.lon);
  };

  const cancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm(emptyForm);
    setAddressValidated(false);
    setBuildingInfo(null);
    setSuggestions([]);
  };

  const pickSuggestion = (s: AddressSuggestion) => {
    setForm((f) => ({ ...f, address: s.value, lat: s.geoLat, lon: s.geoLon }));
    setSuggestions([]);
    setAddressValidated(true);
    fetchBuildingInfo(s.value, s.geoLat, s.geoLon);
  };

  const handleSave = async () => {
    if (!form.address.trim()) {
      toast.error('Введите адрес');
      return;
    }
    if (!addressValidated) {
      toast.error('Выберите адрес из выпадающих подсказок');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        label: form.label.trim() || undefined,
        address: form.address.trim(),
        lat: form.lat ?? undefined,
        lon: form.lon ?? undefined,
        apartment: form.apartment.trim() || undefined,
        entrance: form.entrance.trim() || undefined,
        floor: form.floor.trim() || undefined,
        intercom: form.intercom.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingId != null) {
        await api.patch(`/addresses/${editingId}`, payload);
        toast.success('Адрес обновлён');
      } else {
        await api.post('/addresses', payload);
        toast.success('Адрес сохранён');
      }
      await queryClient.invalidateQueries({ queryKey: ['savedAddresses'] });
      cancel();
    } catch (error) {
      if (error instanceof AxiosError) {
        const msg = error.response?.data?.message;
        toast.error(Array.isArray(msg) ? msg.join('. ') : msg ?? 'Ошибка сохранения');
      } else {
        toast.error('Ошибка сохранения');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот адрес?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['savedAddresses'] });
      toast.success('Адрес удалён');
    } catch {
      toast.error('Не удалось удалить адрес');
    }
  };

  const limitReached = (addresses?.length ?? 0) >= MAX_ADDRESSES;
  const isEditing = editingId != null || isAdding;

  const maxEntrance = buildingInfo?.entranceCount ?? null;
  const maxFloor = buildingInfo?.floorsCount ?? null;
  const minFloor =
    buildingInfo?.floorsUnderground && buildingInfo.floorsUnderground > 0
      ? -buildingInfo.floorsUnderground
      : 1;

  const entranceNum = form.entrance ? parseInt(form.entrance, 10) : null;
  const entranceInvalid =
    maxEntrance != null && entranceNum != null && (entranceNum < 1 || entranceNum > maxEntrance);

  const floorNum = form.floor ? parseInt(form.floor, 10) : null;
  const floorInvalid =
    maxFloor != null &&
    floorNum != null &&
    (floorNum < minFloor || floorNum > maxFloor);

  const apartmentInvalid =
    !!form.apartment && !isApartmentInBuilding(form.apartment, buildingInfo);

  return (
    <FadeIn>
      <div className='max-w-lg mx-auto space-y-6'>
        <div className='flex items-center gap-2'>
          <Link href='/profile'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
          <h1 className='text-2xl font-bold'>Мои адреса</h1>
        </div>

        {isLoading && <Skeleton className='h-24 w-full rounded-xl' />}

        {!isLoading && addresses && addresses.length === 0 && !isEditing && (
          <Card>
            <CardContent className='py-8 text-center text-sm text-muted-foreground space-y-3'>
              <p>Сохранённых адресов пока нет.</p>
              <p className='text-xs'>
                Адрес из ближайшего заказа сохранится автоматически, либо
                добавьте его вручную.
              </p>
            </CardContent>
          </Card>
        )}

        {addresses && addresses.length > 0 && (
          <div className='space-y-2'>
            {addresses.map((a) => (
              <Card key={a.id}>
                <CardContent className='p-4 flex items-start gap-3'>
                  <MapPin className='h-4 w-4 mt-0.5 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 flex-1 space-y-0.5'>
                    {a.label && (
                      <p className='text-xs text-muted-foreground'>
                        {a.label}
                      </p>
                    )}
                    <p className='text-sm font-medium break-words'>{a.address}</p>
                    {(a.apartment || a.entrance || a.floor || a.intercom) && (
                      <p className='text-xs text-muted-foreground'>
                        {[
                          a.apartment && `кв./офис ${a.apartment}`,
                          a.entrance && `подъезд ${a.entrance}`,
                          a.floor && `этаж ${a.floor}`,
                          a.intercom && `домофон ${a.intercom}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    {a.notes && (
                      <p className='text-xs text-muted-foreground'>
                        Комментарий: {a.notes}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-1 shrink-0'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => startEdit(a)}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className='h-4 w-4 text-destructive' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isEditing && (
          <Card>
            <CardContent className='p-4 space-y-3'>
              <p className='text-sm font-semibold'>
                {editingId != null ? 'Изменить адрес' : 'Новый адрес'}
              </p>
              <div className='space-y-1.5'>
                <Label htmlFor='form-label'>Метка (необязательно)</Label>
                <Input
                  id='form-label'
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                  placeholder='Дом, Работа…'
                  maxLength={40}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='form-address'>Адрес</Label>
                <div className='relative'>
                  <Input
                    id='form-address'
                    value={form.address}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        address: e.target.value,
                        lat: null,
                        lon: null,
                      });
                      setAddressValidated(false);
                      setBuildingInfo(null);
                    }}
                    placeholder='Начните вводить улицу, затем выберите из списка'
                    maxLength={300}
                    autoComplete='off'
                  />
                  {suggestions.length > 0 && (
                    <ul className='absolute z-30 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto'>
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          className='px-3 py-2 text-sm cursor-pointer hover:bg-accent'
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickSuggestion(s);
                          }}
                        >
                          {s.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {addressValidated ? (
                  <p className='text-xs text-green-700 dark:text-green-400 inline-flex items-center gap-1'>
                    <CheckCircle2 className='h-3.5 w-3.5' />
                    Адрес подтверждён
                  </p>
                ) : (
                  <p className='text-xs text-muted-foreground'>
                    Выберите адрес из выпадающего списка — мы доставляем только по Нижнему Новгороду.
                  </p>
                )}
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label htmlFor='form-apt'>Квартира / офис</Label>
                  <Input
                    id='form-apt'
                    value={form.apartment}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        apartment: sanitizeApartment(e.target.value),
                      })
                    }
                    aria-invalid={apartmentInvalid}
                    className={apartmentInvalid ? 'border-destructive' : ''}
                  />
                  {apartmentInvalid ? (
                    <p className='text-[11px] text-destructive'>
                      Квартира вне диапазона дома
                    </p>
                  ) : buildingInfo?.apartmentRanges?.length ? (
                    <p className='text-[11px] text-muted-foreground'>
                      {describeApartmentRanges(buildingInfo)}
                    </p>
                  ) : null}
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='form-entrance'>Подъезд</Label>
                  <Input
                    id='form-entrance'
                    inputMode='numeric'
                    value={form.entrance}
                    onChange={(e) =>
                      setForm({ ...form, entrance: sanitizeDigits(e.target.value) })
                    }
                    aria-invalid={entranceInvalid}
                    className={entranceInvalid ? 'border-destructive' : ''}
                  />
                  {entranceInvalid ? (
                    <p className='text-[11px] text-destructive'>
                      В доме {maxEntrance} подъезд(ов)
                    </p>
                  ) : maxEntrance != null ? (
                    <p className='text-[11px] text-muted-foreground'>
                      В доме {maxEntrance} подъезд(ов)
                    </p>
                  ) : null}
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='form-floor'>Этаж</Label>
                  <Input
                    id='form-floor'
                    inputMode='numeric'
                    value={form.floor}
                    onChange={(e) =>
                      setForm({ ...form, floor: sanitizeFloor(e.target.value) })
                    }
                    aria-invalid={floorInvalid}
                    className={floorInvalid ? 'border-destructive' : ''}
                  />
                  {floorInvalid ? (
                    <p className='text-[11px] text-destructive'>
                      Этажность дома: {minFloor}…{maxFloor}
                    </p>
                  ) : maxFloor != null ? (
                    <p className='text-[11px] text-muted-foreground'>
                      Этажность дома: до {maxFloor}
                      {buildingInfo?.floorsUnderground
                        ? ` (есть ${buildingInfo.floorsUnderground} подз.)`
                        : ''}
                    </p>
                  ) : null}
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='form-intercom'>Домофон</Label>
                  <Input
                    id='form-intercom'
                    value={form.intercom}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        intercom: sanitizeIntercom(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='form-notes'>Комментарий (необязательно)</Label>
                <textarea
                  id='form-notes'
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={2}
                  maxLength={500}
                  className='w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none'
                />
              </div>
              <div className='flex gap-2 pt-1'>
                <Button
                  onClick={handleSave}
                  disabled={
                    isSaving ||
                    !addressValidated ||
                    entranceInvalid ||
                    floorInvalid ||
                    apartmentInvalid
                  }
                >
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </Button>
                <Button variant='outline' onClick={cancel} disabled={isSaving}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isEditing && (
          <Button
            variant='outline'
            className='w-full gap-2'
            onClick={startAdd}
            disabled={limitReached}
          >
            <Plus className='h-4 w-4' />
            {limitReached
              ? `Лимит ${MAX_ADDRESSES} адресов достигнут`
              : 'Добавить адрес'}
          </Button>
        )}
      </div>
    </FadeIn>
  );
}
