import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageKey: 'msg',
      },
    },
  }),
});

/**
 * Returns a child logger with a `module` label on every line.
 * Usage: const log = createLogger('auth');
 */
export function createLogger(module: string) {
  return logger.child({ module });
}

export default logger;
