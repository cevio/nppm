import * as detect from 'detect-port';
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

function pickFreePort(start: number, end: number) {
  return parseInt(String(Math.random() * (end - start))) + start;
}

function checkPort(port: number) {
  return detect(port);
}

export const Port = {
  check: checkPort,
  range: pickFreePort,
}