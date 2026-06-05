import i18n from '../i18n';

/**
 * Прокси-объект для обратной совместимости с константами-словарями вида
 * `CONST[code]`: возвращает перевод i18n по ключу `${prefix}.${code}` в неймспейсе
 * `ns`. Раньше такие словари были захардкожены на русском и не переключались при
 * смене языка — теперь это тонкая обёртка над i18n, читающая актуальную локаль
 * при каждом доступе (поэтому переживает рантайм-смену языка).
 *
 * Двоеточие в коде (например, "RF:B") i18next трактует как разделитель неймспейса,
 * поэтому отключаем nsSeparator. Если перевода нет — возвращаем сам код.
 */
export function makeLabelProxy(prefix: string, ns: string): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_target, code) {
      if (typeof code !== 'string') return undefined;
      return i18n.t(`${prefix}.${code}`, { ns, nsSeparator: false, defaultValue: code });
    },
  });
}
