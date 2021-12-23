import { createProcess, Worker } from '@nppm/process';
import { configure, getLogger } from 'log4js';
import { TestService } from './service';

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

const [bootstrap, lifecycle] = createProcess(logger, e => logger.error(e));

lifecycle.use(() => {
  return Worker({
    port: 8761,
    services: [TestService],
    zookeeper: '127.0.0.1:2181',
    logger
  })
}).use(async () => {
  const radox = Worker.radox.value;

  await Promise.all([
    radox.sendback({
      command: 'com.nppm.http.service',
      method: 'registerHTTPRoutes',
      arguments: ['dingdingAuthorize', [
        {
          HttpMethod: 'GET',
          HttpRouter: '/~/login/dingding/v1/authorize',
          RPCNamespace: 'com.nppm.test.service',
          RPCMethod: 'authorize',
        }
      ]]
    }),
    radox.sendback({
      command: 'com.nppm.http.service',
      method: 'registerLoginPlugin',
      arguments: ['dingding', {
        auth: {
          command: 'com.nppm.test.service',
          method: 'authorize'
        },
        check: {
          command: 'com.nppm.test.service',
          method: 'check'
        }
      }]
    })
  ])

  return async () => {
    await radox.sendback({
      command: 'com.nppm.http.service',
      method: 'unRegisterHTTPRoutes',
      arguments: ['dingding']
    })
  }
})

bootstrap(() => logger.warn('NPPM REGISTRY STARTED.'));