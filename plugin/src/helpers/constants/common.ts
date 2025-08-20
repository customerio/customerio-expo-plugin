/**
 * Platform constants for native SDK initialization
 */
export const PLATFORM = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

/**
 * Platform type definition
 */
export type Platform = typeof PLATFORM[keyof typeof PLATFORM];
