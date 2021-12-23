import { createProcess, Worker } from '@nppm/process';
import { configure, getLogger } from 'log4js';
import { DingTalkService } from './service';
import { Port } from '@nppm/toolkit';

const pkg = require('../package.json');

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

lifecycle.use(async () => {
  const port = await Port.check(Port.range(10000, 20000));
  return Worker({
    port,
    services: [DingTalkService],
    zookeeper: '127.0.0.1:2181',
    logger
  })
}).use(async () => {
  const radox = Worker.radox.value;

  await Promise.all([
    radox.sendback({
      command: 'com.nppm.http.service',
      method: 'registerHTTPRoutes',
      arguments: ['dingtalk:task', [
        {
          HttpMethod: 'GET',
          HttpRouter: '/~/v1/login/dingtalk/task',
          RPCNamespace: 'com.nppm.login.dingtalk.service',
          RPCMethod: 'task',
        }
      ]]
    }),
    radox.sendback({
      command: 'com.nppm.http.service',
      method: 'registerLoginPlugin',
      arguments: [pkg.name, {
        auth: {
          command: 'com.nppm.login.dingtalk.service',
          method: 'auth'
        },
        check: {
          command: 'com.nppm.login.dingtalk.service',
          method: 'check'
        }
      }]
    })
  ])

  return async () => {
    await Promise.all([
      radox.sendback({
        command: 'com.nppm.http.service',
        method: 'unRegisterHTTPRoutes',
        arguments: ['dingtalk:task'],
      }),
      radox.sendback({
        command: 'com.nppm.http.service',
        method: 'unRegisterLoginPlugin',
        arguments: [pkg.name],
      })
    ])
  }
})

bootstrap(() => logger.warn('DINGTALK PLUGIN STARTED.'));