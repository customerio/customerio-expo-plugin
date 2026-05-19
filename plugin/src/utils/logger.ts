import { format } from 'util';

// Use CUSTOMERIO_DEBUG_MODE if defined; otherwise enable in development mode only
const VERBOSE_MODE =
  process.env.CUSTOMERIO_DEBUG_MODE !== undefined
    ? process.env.CUSTOMERIO_DEBUG_MODE === 'true'
    : process.env.NODE_ENV === 'development';
const PREFIX = '[CustomerIO]';
const formatMessage = (message: string): string => `${PREFIX} ${message}`;

// `info`/`log`/`debug` go straight to stderr via `process.stderr.write` rather
// than `console.log/info/debug` (which default to stdout). Expo's CLI parses
// `expo config --json` stdout as JSON and eas-cli no longer falls back on a
// parse failure — a single stray verbose line aborts the build. Keeping
// verbose output on stderr makes the trace impossible to leak into that
// stream, regardless of host console rebinding.
const writeStderr = (message: string, args: unknown[]): void => {
  const line = args.length > 0 ? format(message, ...args) : message;
  process.stderr.write(`${line}\n`);
};

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
      writeStderr(formatMessage(message), args);
    }
  },

  log: (message: string, ...args: unknown[]): void => {
    if (VERBOSE_MODE) {
      writeStderr(formatMessage(message), args);
    }
  },

  debug: (message: string, ...args: unknown[]): void => {
    if (VERBOSE_MODE) {
      writeStderr(formatMessage(message), args);
    }
  }
};
