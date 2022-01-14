import { ConfigCacheAble } from '../cache';
import { ConfigEntity } from '@nppm/entity';
import { updateORMState, updateRedisState } from '../configs';
import { HttpNotAcceptableException } from '@typeservice/exception';
import { HTTPController, HTTPRouter, HTTPRequestBody } from '@typeservice/http';
import { ORM_CONNECTION_CONTEXT, REDIS_CONNECTION_CONTEXT, TORMConfigs, TCreateRedisServerProps } from '@nppm/utils';

@HTTPController()
export class HttpSetupService {
  get connection() {
    return ORM_CONNECTION_CONTEXT.value;
  }

  @HTTPRouter({
    pathname: '/~/setup/mode',
    methods: 'GET'
  })
  public getWebsiteMode() {
    if (!ORM_CONNECTION_CONTEXT.value) return 1;
    if (!REDIS_CONNECTION_CONTEXT.value) return 2;
    return 0;
  }

  @HTTPRouter({
    pathname: '/~/setup/orm',
    methods: 'POST'
  })
  public async setORMState(@HTTPRequestBody() body: TORMConfigs) {
    const rollback = updateORMState(body);
    const status = await this.checkStatus(() => !!ORM_CONNECTION_CONTEXT.value, 1000, 30 * 1000);
    if (status) {
      const ConfigRepository = this.connection.getRepository(ConfigEntity);
      let configs = await ConfigRepository.findOne();
      if (!configs) {
        const _configs = new ConfigEntity();
        _configs.domain = 'http://127.0.0.1:3000';
        _configs.login_code = 'default';
        _configs.registries = ["https://registry.npm.taobao.org/", "https://registry.npmjs.org/"];
        _configs.scopes = ['@node'];
        configs = await ConfigRepository.save(_configs);
      }
    } else {
      rollback();
    }
    return status;
  }

  @HTTPRouter({
    pathname: '/~/setup/redis',
    methods: 'POST'
  })
  public async setRedisState(@HTTPRequestBody() body: TCreateRedisServerProps) {
    if (!body.host || !body.port) throw new HttpNotAcceptableException('redis地址和redis端口必填');
    const rollback = updateRedisState(body);
    const status = await this.checkStatus(() => !!REDIS_CONNECTION_CONTEXT.value, 1000, 30 * 1000);
    if (status) {
      await ConfigCacheAble.build();
    } else {
      rollback();
    }
    return status;
  }

  private checkStatus(fn: () => boolean, step: number, timeout: number) {
    const nextTime = Date.now() + timeout;
    return new Promise<boolean>((resolve) => {
      const timer = setInterval(() => {
        if (Date.now() >= nextTime) {
          clearInterval(timer);
          return resolve(false);
        }
        if (fn()) return resolve(true);
      }, step);
    })
  }
}