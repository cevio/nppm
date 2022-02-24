import { resolve } from 'url';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { HttpAcceptedException, HttpServiceUnavailableException } from '@typeservice/exception';
import { stacks } from './state';
import { Service } from './service';

const namespace: string = require('../package.json').name;

export default function WechatWorkApplication(npmcore: NPMCore) {
  ConfigCacheAble.redis = npmcore.redis.value;

  const removeService = npmcore.http.value.createService(Service);
  const loginModule = npmcore.createLoginModule(namespace);

  loginModule.addLoginURL(createLoginURL(npmcore)).addDoneUrl(createDoneURL(npmcore));
  npmcore.addLoginModule(loginModule);
  
  return () => {
    removeService();
    npmcore.removeLoginModule(loginModule);
  }
}


function createLoginURL(npmcore: NPMCore) {
  return async (session: string) => {
    const configs = await ConfigCacheAble.get(null, npmcore.orm.value);
    const { appid, agentid, expire } = npmcore.loadPluginState(namespace);
    const redirect_url = encodeURIComponent(resolve(configs.domain, '/~/v1/login/wechat/work/authorize'));
    const timer = setTimeout(() => {
      if (stacks.has(session)) stacks.delete(session);
    }, Number(expire) * 60 * 1000);
    stacks.set(session, { status: 0, data: null, msg: null, timer });
    return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${appid}&agentid=${agentid}&redirect_uri=${redirect_url}&state=${session}`;
  }
}

function createDoneURL(npmcore: NPMCore) {
  return async (session: string) => {
    const { retryAfter } = npmcore.loadPluginState(namespace);
    const tryAgain = new HttpAcceptedException();
    tryAgain.set('retry-after', retryAfter + '');
    if (!stacks.has(session)) throw tryAgain;
    const state = stacks.get(session);
    switch (state.status) {
      case 3: 
        clearTimeout(state.timer);
        stacks.delete(session);
        return state.data;
      case -1:
        clearTimeout(state.timer);
        stacks.delete(session);
        throw new HttpServiceUnavailableException(state.msg);
      default: throw tryAgain;
    }
  }
}