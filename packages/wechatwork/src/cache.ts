import { CacheAble } from '@nppm/utils';
import axios, { AxiosResponse } from 'axios';
import { TAccessToken } from './interface';
import { HttpServiceUnavailableException } from '@typeservice/exception';

type TCacheParams = {
  id: string, 
  secret: string,
}

export const AccessTokenCacheAble = new CacheAble<string, [], TCacheParams>({
  memory: true,
  path: '/access/token/wechat/work/id/:id/secret/:secret',
  async handler(args) {
    const res = await axios.get<any, AxiosResponse<TAccessToken>>(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${args.id}&corpsecret=${args.secret}`
    );
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      data: data.access_token,
      expire: data.expires_in,
    }
  }
})