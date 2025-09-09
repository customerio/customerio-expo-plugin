import type { NativeSDKConfig, RichPushConfig } from '../types/cio-types';
import { logger } from './logger';

/**
 * Validates a condition and handles errors based on CUSTOMERIO_STRICT_MODE flag.
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
  // Throw an error if strict mode is enabled, log a warning otherwise
  if (process.env.CUSTOMERIO_STRICT_MODE === 'true') {
    throw new Error(logger.format(message));
  } else {
    logger.warn(message);
  }
  return false;
}

function isUndefined(value: unknown): boolean {
  return value === undefined;
}

function validateRequired(value: unknown, fieldName: string, context: string): boolean {
  return validate(
    () => !isUndefined(value) && value !== null,
    () => `${context}: ${fieldName} is required, received: ${value}`
  );
}

function validateString(value: unknown, fieldName: string, context: string): boolean {
  return validate(
    () => isUndefined(value) || (typeof value === 'string' && value.trim() !== ''),
    () => `${context}: ${fieldName} must be a non-empty string, received: ${typeof value === 'string' ? `"${value}"` : value}`
  );
}

function validateBoolean(value: unknown, fieldName: string, context: string): boolean {
  return validate(
    () => isUndefined(value) || typeof value === 'boolean',
    () => `${context}: ${fieldName} must be a boolean, received: ${value}`
  );
}

function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
  context: string
): boolean {
  if (isUndefined(value)) return true;

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

function validateRegion(value: unknown, fieldName: string, context: string): boolean {
  return validateEnum(value, fieldName, ['US', 'EU'], context);
}

function validateNativeSDKConfig(config: NativeSDKConfig): boolean {
  const context = 'NativeSDKConfig';

  let isValid = true;

  isValid = validateRequired(config.cdpApiKey, 'cdpApiKey', context) && isValid;
  isValid = validateString(config.cdpApiKey, 'cdpApiKey', context) && isValid;
  isValid = validateRegion(config.region, 'region', context) && isValid;
  isValid = validateEnum(config.screenViewUse, 'screenViewUse', ['all', 'inapp'], context) && isValid;
  isValid = validateEnum(config.logLevel, 'logLevel', ['none', 'error', 'info', 'debug'], context) && isValid;
  isValid = validateBoolean(config.autoTrackDeviceAttributes, 'autoTrackDeviceAttributes', context) && isValid;
  isValid = validateBoolean(config.trackApplicationLifecycleEvents, 'trackApplicationLifecycleEvents', context) && isValid;
  isValid = validateString(config.siteId, 'siteId', context) && isValid;
  isValid = validateString(config.migrationSiteId, 'migrationSiteId', context) && isValid;

  return isValid;
}

function validateRichPushConfig(config: RichPushConfig | undefined): boolean {
  const context = 'NotificationServiceExtension';

  let isValid = true;

  isValid = validateRequired(config?.cdpApiKey, 'cdpApiKey', context) && isValid;
  isValid = validateString(config?.cdpApiKey, 'cdpApiKey', context) && isValid;
  isValid = validateRegion(config?.region, 'region', context) && isValid;

  return isValid;
}

export {
  validateNativeSDKConfig,
  validateRequired,
  validateRichPushConfig,
  validateString
};

