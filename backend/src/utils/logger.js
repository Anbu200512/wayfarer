const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

export const logger = {
  info: (message, ...rest) => console.log(`${COLORS.cyan}[info]${COLORS.reset} ${message}`, ...rest),
  warn: (message, ...rest) => console.warn(`${COLORS.yellow}[warn]${COLORS.reset} ${message}`, ...rest),
  error: (message, ...rest) => console.error(`${COLORS.red}[error]${COLORS.reset} ${message}`, ...rest),
  debug: (message, ...rest) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${COLORS.dim}[debug]${COLORS.reset} ${message}`, ...rest);
    }
  },
};

export default logger;
