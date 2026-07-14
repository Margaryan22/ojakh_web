import type { MetadataRoute } from 'next';

// PWA-манифест: делает сайт устанавливаемым («на экран Домой»).
// Push-уведомления уже работают через public/sw.js — манифест дополняет
// картину до полноценного PWA. Цвета — из палитры app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Оджах — армянская домашняя кухня',
    short_name: 'Оджах',
    description:
      'Домашняя армянская еда и торты на заказ с доставкой по Нижнему Новгороду',
    lang: 'ru',
    start_url: '/catalog',
    display: 'standalone',
    background_color: '#faf8f3',
    theme_color: '#d4a574',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
