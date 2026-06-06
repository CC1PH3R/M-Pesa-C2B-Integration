interface LogData {
  [key: string]: unknown;
}

const logger = {
  info: (message: string, data: LogData = {}): void => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      ...data,
    }));
  },

  error: (message: string, error: unknown = {}): void => {
    const err = error as Error;
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: err.message ?? error,
      stack: err.stack,
    }));
  },

  warn: (message: string, data: LogData = {}): void => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      ...data,
    }));
  },

  debug: (message: string, data: LogData = {}): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        ...data,
      }));
    }
  },
};

export default logger;
