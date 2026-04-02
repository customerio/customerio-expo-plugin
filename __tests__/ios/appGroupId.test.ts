import { validatePushNotificationOptions } from '../../plugin/src/utils/validation';

// Suppress logger output during tests
jest.mock('../../plugin/src/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), format: jest.fn((m: string) => m) },
}));

describe('validatePushNotificationOptions', () => {
  const { logger } = require('../../plugin/src/utils/logger');

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CUSTOMERIO_STRICT_MODE;
  });

  it('returns true and emits no warning when appGroupId is a valid group. identifier', () => {
    const result = validatePushNotificationOptions({ appGroupId: 'group.com.example.app' });
    expect(result).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('emits a warning when appGroupId does not start with "group."', () => {
    const result = validatePushNotificationOptions({ appGroupId: 'custom.identifier' });
    expect(result).toBe(true); // still valid, just a warning
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('does not start with "group."'));
  });

  it('returns false (warning) when appGroupId is an empty string', () => {
    const result = validatePushNotificationOptions({ appGroupId: '' });
    expect(result).toBe(false);
  });

  it('returns true when appGroupId is undefined (field is optional)', () => {
    const result = validatePushNotificationOptions({});
    expect(result).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws in strict mode when appGroupId is empty', () => {
    process.env.CUSTOMERIO_STRICT_MODE = 'true';
    expect(() => validatePushNotificationOptions({ appGroupId: '' })).toThrow();
    delete process.env.CUSTOMERIO_STRICT_MODE;
  });
});
