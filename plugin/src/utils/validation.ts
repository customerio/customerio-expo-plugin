import type { NativeSDKConfig } from '../types/cio-types';

// Centralized logging utility that adds [CustomerIO] prefix and respects debug flag
function logWarning(message: string): void {
  // Default to enabled unless explicitly disabled
  if (process.env.CUSTOMERIO_DEBUG !== 'false') {
    console.warn(`[CustomerIO] ${message}`);
  }
}

/**
 * Validates a condition and handles errors based on CUSTOMERIO_STRICT_VALIDATION flag.
 * @param isValid - Function that returns true if validation passes
 * @param messageFactory - Function that returns the error message if validation fails
 * @returns true if validation passes, false if it fails
 */
function validate(isValid: () => boolean, messageFactory: () => string): boolean {
  if (isValid()) {
    return true;
  }

  // Throw errors unless explicitly disabled, default to strict validation
  const message = messageFactory();
  if (process.env.CUSTOMERIO_STRICT_VALIDATION !== 'false') {
    throw new Error(`[CustomerIO] ${message}`);
  } else {
    logWarning(message);
  }
  return false;
}

function validateString(value: unknown, fieldName: string, context: string): boolean {
  return validate(
    () => value === undefined || (typeof value === 'string' && value.trim() !== ''),
    () => `${context}: ${fieldName} must be a non-empty string, received: ${typeof value === 'string' ? `"${value}"` : value}`
  );
}

function validateBoolean(value: unknown, fieldName: string, context: string): boolean {
  return validate(
    () => value === undefined || typeof value === 'boolean',
    () => `${context}: ${fieldName} must be a boolean, received: ${value}`
  );
}

function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
  context: string
): boolean {
  if (value === undefined) return true;

  // First validate it's a string
  if (!validateString(value, fieldName, context)) {
    return false;
  }

  // Then validate it's in the allowed values
  return validate(
    () => {
      const lowerValue = (value as string).toLowerCase();
      const lowerAllowedValues = allowedValues.map(v => v.toLowerCase());
      return lowerAllowedValues.includes(lowerValue);
    },
    () => {
      const valuesStr = allowedValues.map(v => `"${v}"`).join(', ');
      return `${context}: ${fieldName} must be one of ${valuesStr}, received: ${value}`;
    }
  );
}

function validateNativeSDKConfig(config: NativeSDKConfig): boolean {
  const context = 'NativeSDKConfig';

  let isValid = true;

  // Only validate cdpApiKey as a string if it's defined - don't require it
  // This allows for undefined values during builds where env vars may not be injected yet
  isValid = validateString(config.cdpApiKey, 'cdpApiKey', context) && isValid;

  // Other fields are only validated if they're defined (already handled by individual validators)
  isValid = validateEnum(config.region, 'region', ['US', 'EU'] as const, context) && isValid;
  isValid = validateEnum(config.screenViewUse, 'screenViewUse', ['all', 'inapp'] as const, context) && isValid;
  isValid = validateEnum(config.logLevel, 'logLevel', ['none', 'error', 'info', 'debug'] as const, context) && isValid;
  isValid = validateBoolean(config.autoTrackDeviceAttributes, 'autoTrackDeviceAttributes', context) && isValid;
  isValid = validateBoolean(config.trackApplicationLifecycleEvents, 'trackApplicationLifecycleEvents', context) && isValid;
  isValid = validateString(config.siteId, 'siteId', context) && isValid;
  isValid = validateString(config.migrationSiteId, 'migrationSiteId', context) && isValid;

  return isValid;
}

export { logWarning, validateNativeSDKConfig, validateString };
