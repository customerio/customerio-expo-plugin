import type { NativeSDKConfig } from '../types/cio-types';

function validateRequired(value: unknown, fieldName: string, context: string): void {
  if (value === undefined || value === null) {
    throw new Error(`${context}: ${fieldName} is required, received: ${value}`);
  }
}

function validateString(value: unknown, fieldName: string, context: string): void {
  if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
    throw new Error(`${context}: ${fieldName} must be a non-empty string, received: ${typeof value === 'string' ? `"${value}"` : value}`);
  }
}

function validateBoolean(value: unknown, fieldName: string, context: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${context}: ${fieldName} must be a boolean, received: ${value}`);
  }
}

function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
  context: string
): void {
  if (value === undefined) return;

  validateString(value, fieldName, context);

  const lowerValue = (value as string).toLowerCase();
  const lowerAllowedValues = allowedValues.map(v => v.toLowerCase());
  if (!lowerAllowedValues.includes(lowerValue)) {
    const valuesStr = allowedValues.map(v => `"${v}"`).join(', ');
    throw new Error(`${context}: ${fieldName} must be one of ${valuesStr}, received: ${value}`);
  }
}

function validateNativeSDKConfig(config: NativeSDKConfig): void {
  const context = 'NativeSDKConfig';

  validateRequired(config.cdpApiKey, 'cdpApiKey', context);
  validateString(config.cdpApiKey, 'cdpApiKey', context);

  validateEnum(config.region, 'region', ['US', 'EU'] as const, context);
  validateEnum(config.screenViewUse, 'screenViewUse', ['all', 'inapp'] as const, context);
  validateEnum(config.logLevel, 'logLevel', ['none', 'error', 'info', 'debug'] as const, context);
  validateBoolean(config.autoTrackDeviceAttributes, 'autoTrackDeviceAttributes', context);
  validateBoolean(config.trackApplicationLifecycleEvents, 'trackApplicationLifecycleEvents', context);
  validateString(config.siteId, 'siteId', context);
  validateString(config.migrationSiteId, 'migrationSiteId', context);
}

export { validateNativeSDKConfig };
