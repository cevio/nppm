import { configure, getLogger } from 'log4js';

configure({
  pm2: false,
  appenders: {
    console: {
      type: 'stdout',
    }
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'info'
    },
  }
});

export const logger = getLogger();