import { createProcess, createContext } from '@typeservice/process';
import { DingTalkService } from './service';
import { Port, logger } from './util';
import { Radox } from '@typeservice/radox';
import { Container } from 'inversify';

const pkg = require('../package.json');
const container = new Container();
const [bootstrap, lifecycle] = createProcess(e => logger.error(e));

export const RadoxContext = createContext<Radox>();

lifecycle.createServer(async () => {
  const port = await Port.check(Port.range(10000, 20000));
  const radox = new Radox({
    port, container, logger,
    zookeeper: '127.0.0.1:2181',
  });
  RadoxContext.setContext(radox);
  radox.define(DingTalkService);
  await radox.listen();
  return () => radox.close();
}).createServer(async () => {
  const radox = RadoxContext.value;

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

bootstrap().then(() => logger.warn('DINGTALK PLUGIN STARTED.'));