import winston from 'winston';
import { config } from '../config/env.js';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  // Use 'YYYY-MM-DD hh:mm:ss A' for 12-hour format with AM/PM
  winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }),
  config.NODE_ENV === 'development'
    ? winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}]: ${info.message}`
        )
      )
    : winston.format.json()
);

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  format,
  transports: [new winston.transports.Console()],
});