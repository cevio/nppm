import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { createHmac } from 'crypto';
import { stacks } from './state';
import { TOpenID, TUserID, TUserInfo } from './interface';
import axios, { AxiosResponse } from 'axios';
import { HTTPController, HTTPRouter, HTTPRequestQuery } from '@typeservice/http';
import { HttpServiceUnavailableException } from '@typeservice/exception';
import { MD5 } from 'crypto-js';
import { AccessTokenCacheAble } from './cache';

const pkgname = require('../package.json').name;

@HTTPController()
export class Service {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/v1/login/dingtalk/authorize',
    methods: 'GET'
  })
  public async main(
    @HTTPRequestQuery('code') code: string,
    @HTTPRequestQuery('state') state: string,
  ) {
    const { appid, appkey, appsecret, appidsecret } = this.npmcore.loadPluginState(pkgname);
    const result = stacks.get(state);
    const access_token = await AccessTokenCacheAble.get({ appKey: appkey, appSecret: appsecret });
    result.status = 1;
    const { unionid, openid } = await this.getOpenID(code, appid, appidsecret);
    result.status = 2;
    const userid = await this.getUserId(access_token, unionid);
    result.status = 3;
    const user = await this.getUserInfo(access_token, userid);
    result.data = Object.assign(user, { token: MD5('dingtalk_' + openid).toString() });
    result.status = 4;
    throw await this.npmcore.setLoginAuthorize(state);
  }

  private async getOpenID(code: string, appid: string, appidsecret: string) {
    const timestamp = Date.now();
    const signature = this.signature(timestamp, appidsecret);
    const url = `https://oapi.dingtalk.com/sns/getuserinfo_bycode?accessKey=${appid}&timestamp=${timestamp}&signature=${signature}`;
    const res = await axios.post<any, AxiosResponse<TOpenID>>(url, {
      tmp_auth_code: code
    });
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      openid: data.user_info.openid,
      unionid: data.user_info.unionid,
    }
  }

  private signature(timestamp: number, appSecret: string) {
    const hmac = createHmac('sha256', appSecret);
    hmac.update(timestamp + '');
    return encodeURIComponent(hmac.digest('base64'));
  }

  private async getUserId(access_token: string, unionid: string) {
    const res = await axios.get<any, AxiosResponse<TUserID>>(`https://oapi.dingtalk.com/user/getUseridByUnionid?access_token=${access_token}&unionid=${unionid}`);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return data.userid;
  }

  private async getUserInfo(access_token: string, userid: string) {
    const res = await axios.get<any, AxiosResponse<TUserInfo>>(`https://oapi.dingtalk.com/user/get?access_token=${access_token}&userid=${userid}`);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      account: 'dingtalk_' + data.userid, 
      avatar: data.avatar, 
      email: data.email, 
      nickname: data.name,
    }
  }
}