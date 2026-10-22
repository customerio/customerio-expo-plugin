import { PLATFORM, type Platform } from '../constants/common';

/**
 * Keys carry their region after the type prefix, e.g. `pk_eu_...`.
 */
const KEY_REGION_PREFIX = /^[a-z]{2}_(us|eu)_/;

/**
 * Secret keys start with `sk_`. They are for servers only and must never ship inside an app.
 */
const SECRET_KEY_PREFIX = 'sk_';

/**
 * Fails the build when an app is set up with a secret `sk_` key, so it never ends up in the
 * app binary or the notification service extension. Apps must use the public `pk_` key.
 */
export function assertNotSecretCdpApiKey(cdpApiKey: unknown, fieldName: string): void {
  if (typeof cdpApiKey === 'string' && cdpApiKey.trim().startsWith(SECRET_KEY_PREFIX)) {
    throw new Error(
      `Customer.io: ${fieldName} is a secret key (sk_). Secret keys must never be put in an app. ` +
      'Use your public key (pk_) instead.'
    );
  }
}

/**
 * Region in a key prefix, or undefined for a key without one.
 */
export function regionFromCdpApiKey(cdpApiKey: string): 'US' | 'EU' | undefined {
  const match = KEY_REGION_PREFIX.exec(cdpApiKey);
  return match ? (match[1].toUpperCase() as 'US' | 'EU') : undefined;
}

/**
 * Region the app set, or the one in the key prefix when it set none, like the native SDKs do.
 * Shared by the app initializer and the notification service extension so both use one region.
 */
export function resolveRegion(
  region: string | undefined,
  cdpApiKey: string | undefined
): string | undefined {
  return region || (cdpApiKey ? regionFromCdpApiKey(cdpApiKey) : undefined);
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
