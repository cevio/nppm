
import { isProduction, env } from './env';
import { configure, getLogger } from 'log4js';

configure({
  pm2: isProduction,
  appenders: {
		console: {
			type: 'stdout',
		},
		file: {
			type: "file",
			filename: `nppm-${env}.log`
		}
  },
  categories: {
		development: {
			appenders: ['console'],
			level: 'info'
		},
		production: {
			appenders: ['file'],
			level: 'info'
		},
		default: {
			appenders: ['console'],
			level: 'info'
		}
  }
});

export const logger = getLogger(env);
