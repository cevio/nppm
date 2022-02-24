import { CacheAble } from '@nppm/utils';
import axios, { AxiosResponse } from 'axios';
import { TAccessToken } from './interface';
import { HttpServiceUnavailableException } from '@typeservice/exception';

type TCacheParams = {
  appKey: string, 
  appSecret: string,
}

export const AccessTokenCacheAble = new CacheAble<string, [], TCacheParams>({
  memory: true,
  path: '/access/token/dingtalk/appkey/:appKey/secret/:appSecret',
  async handler(args) {
    const res = await axios.get<any, AxiosResponse<TAccessToken>>(`https://oapi.dingtalk.com/gettoken?appkey=${args.appKey}&appsecret=${args.appSecret}`);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      data: data.access_token,
      expire: data.expires_in,
    }
  }
})