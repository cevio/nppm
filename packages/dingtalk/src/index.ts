import { resolve } from 'url';
import { NPMCore } from '@nppm/core';
import { ConfigCacheAble } from '@nppm/cache';
import { HttpAcceptedException, HttpServiceUnavailableException } from '@typeservice/exception';
import { stacks, appid } from './state';
import { Service } from './service';

export default async function DingTalkApplication(npmcore: NPMCore, namespace: string) {
  ConfigCacheAble.redis = npmcore.redis.value;
  const configs = await ConfigCacheAble.get(null, npmcore.orm.value);
  const tryAgain = new HttpAcceptedException();
  tryAgain.set('retry-after', '3');
  npmcore.addLoginModule(npmcore.createLoginModule(namespace).addLoginURL(session => {
    const redirect_url = encodeURIComponent(resolve(configs.domain, '/~/v1/login/dingtalk/authorize'));
    const timer = setTimeout(() => {
      if (stacks.has(session)) {
        stacks.delete(session);
      }
    }, 5 * 60 * 1000);
    stacks.set(session, { status: 0, data: null, msg: null, timer });
    return `https://oapi.dingtalk.com/connect/qrconnect?appid=${appid}&response_type=code&scope=snsapi_login&state=${session}&redirect_uri=${redirect_url}`;
  }).addDoneUrl(session => {
    if (!stacks.has(session)) throw tryAgain;
    const state = stacks.get(session);
    switch (state.status) {
      case 4: 
        clearTimeout(state.timer);
        stacks.delete(session);
        return state.data;
      case -1:
        clearTimeout(state.timer);
        stacks.delete(session);
        throw new HttpServiceUnavailableException(state.msg);
      default: throw tryAgain;
    }
  }));
  npmcore.http.value.createService(Service);
}