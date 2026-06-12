// Круглый токен существа с фоллбеком на иконку лапы, если картинки нет.
// Используется в секции Дикого облика и бейджем на портрете персонажа.
import { useState } from 'react';
import { PawPrint } from 'lucide-react';
import { getCreatureImageUrl } from '../../data/creatures';

export function CreatureToken({ name, size, className = '' }: { name: string; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`flex items-center justify-center rounded-full bg-bg-primary border border-border-default text-text-muted shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <PawPrint size={size * 0.55} />
      </span>
    );
  }
  return (
    <img
      src={getCreatureImageUrl(name)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`rounded-full object-cover bg-bg-primary border border-border-default shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
