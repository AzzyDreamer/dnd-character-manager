// Резолвит путь к статическому ассету (из папки public/) с учётом base-пути сборки.
//
// Vite подставляет import.meta.env.BASE_URL равным `base` из vite.config:
//   - при локальной разработке и сборке в корень домена это '/'
//   - при деплое на GitHub Pages в подпапку — '/dnd-character-manager/'
//
// Поэтому абсолютные пути вида '/images/foo.webp' нельзя хардкодить: на Pages
// они уйдут в корень домена и сломаются. Оборачивай их в asset():
//
//   asset('/images/classes/wizard.webp')
//   asset('images/classes/wizard.webp')   // ведущий слеш необязателен
//
// BASE_URL всегда заканчивается на '/', поэтому ведущий слеш у path убирается,
// чтобы не получить двойной слеш.
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL; // например '/' или '/dnd-character-manager/'
  return base + path.replace(/^\/+/, '');
}
