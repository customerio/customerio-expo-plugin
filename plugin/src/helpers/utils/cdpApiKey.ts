import { PLATFORM, type Platform } from '../constants/common';

/**
 * Public `wk_` keys carry their region in the prefix, e.g. `wk_eu_...`.
 */
const PUBLIC_KEY_PREFIX = /^wk_(us|eu)_/;

/**
 * Region in a public `wk_` key prefix, or undefined for any other key.
 */
export function regionFromCdpApiKey(cdpApiKey: string): 'US' | 'EU' | undefined {
  const match = PUBLIC_KEY_PREFIX.exec(cdpApiKey);
  return match ? (match[1].toUpperCase() as 'US' | 'EU') : undefined;
}

/**
 * Escapes a value for use inside a double-quoted Swift or Kotlin string literal, so a key with a
 * quote, backslash or `$` can't break the generated file.
 */
export function escapeForStringLiteral(value: string, platform: Platform): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  // Kotlin treats `$` as a string template, Swift doesn't.
  return platform === PLATFORM.ANDROID ? escaped.replace(/\$/g, '\\$') : escaped;
}
