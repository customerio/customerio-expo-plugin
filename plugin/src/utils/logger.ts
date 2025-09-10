// Use CUSTOMERIO_DEBUG_MODE if defined; otherwise enable in development mode only
const VERBOSE_MODE =
  process.env.CUSTOMERIO_DEBUG_MODE !== undefined
    ? process.env.CUSTOMERIO_DEBUG_MODE === 'true'
    : process.env.NODE_ENV === 'development';
const PREFIX = '[CustomerIO]';
const formatMessage = (message: string): string => `${PREFIX} ${message}`;

export const logger = {
  format: formatMessage,

  error: (message: string, ...args: unknown[]): void => {
    console.error(formatMessage(message), ...args);
  },

  warn: (message: string, ...args: unknown[]): void => {
    console.warn(formatMessage(message), ...args);
  },

  info: (message: string, ...args: unknown[]): void => {
    if (VERBOSE_MODE) {
      console.info(formatMessage(message), ...args);
    }
  },

  log: (message: string, ...args: unknown[]): void => {
    if (VERBOSE_MODE) {
      console.log(formatMessage(message), ...args);
    }
  },

  debug: (message: string, ...args: unknown[]): void => {
    if (VERBOSE_MODE) {
      console.debug(formatMessage(message), ...args);
    }
  }
};
