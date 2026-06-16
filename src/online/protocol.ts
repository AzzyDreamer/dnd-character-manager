// Wire-протокол party-сессии со стороны фронта. Держим синхронным с
// src-tauri/src/party/protocol.rs. Сам обмен сообщениями идёт на Rust; здесь —
// только версия протокола и кодирование «кода партии», который пользователь
// копирует и вставляет («вставил — подключился», см. docs/PLAN_PARTY_LOCAL.md).

export const PROTOCOL_VERSION = 1;

// Дефолтный порт хоста — зеркалит DEFAULT_PORT в src-tauri/src/party/mod.rs.
// Используется только как подсказка в поле ввода; фактический порт выбирает Rust.
export const DEFAULT_PORT = 47331;

// base64url без паддинга — компактно и безопасно для копирования/URL.
function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  return atob(norm + pad);
}

/** Случайный секрет партии (~12 символов). Деттерент, не настоящая авторизация. */
export function generateSecret(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return toBase64Url(String.fromCharCode(...bytes));
}

/** Код партии = base64url("ip:port|secret"): адрес и пароль в одной строке. */
export function encodePartyCode(host: string, port: number, secret: string): string {
  return toBase64Url(`${host}:${port}|${secret}`);
}

export interface PartyAddress {
  host: string;
  port: number;
  secret: string;
}

export function decodePartyCode(code: string): PartyAddress {
  let raw: string;
  try {
    raw = fromBase64Url(code.trim());
  } catch {
    throw new Error('invalid-code');
  }
  const sep = raw.lastIndexOf('|');
  if (sep < 0) throw new Error('invalid-code');
  const addr = raw.slice(0, sep);
  const secret = raw.slice(sep + 1);
  const colon = addr.lastIndexOf(':');
  if (colon < 0) throw new Error('invalid-code');
  const host = addr.slice(0, colon);
  const port = Number.parseInt(addr.slice(colon + 1), 10);
  if (!host || !secret || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('invalid-code');
  }
  return { host, port, secret };
}
