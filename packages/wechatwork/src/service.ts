import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { stacks } from './state';
import { TAccessToken, TOpenID, TUser } from './interface';
import axios, { AxiosResponse } from 'axios';
import { HTTPController, HTTPRouter, HTTPRequestQuery } from '@typeservice/http';
import { HttpServiceUnavailableException } from '@typeservice/exception';

const pkgname = require('../package.json').name;

@HTTPController()
export class Service {
  @inject('npmcore') private readonly npmcore: NPMCore;
  private access_token: string;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/v1/login/wechat/work/authorize',
    methods: 'GET'
  })
  public async main(
    @HTTPRequestQuery('code') code: string,
    @HTTPRequestQuery('state') state: string,
  ) {
    this.npmcore.logger.info('code', code);
    this.npmcore.logger.info('state', state);
    const { appid, agentsecret } = this.npmcore.loadPluginState(pkgname);
    const result = stacks.get(state);
    const access_token = await this.getAccessToken(appid, agentsecret);
    result.status = 1;
    const { openid } = await this.getOpenID(code, access_token);
    result.status = 2;
    const user = await this.getUserInfo(access_token, openid);
    result.data = Object.assign(user, { token: openid });
    result.status = 3;
    throw await this.npmcore.setLoginAuthorize(state);
  }

  private async getAccessToken(appid: string, appsecret: string) {
    const res = await axios.get<any, AxiosResponse<TAccessToken>>(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${appid}&corpsecret=${appsecret}`);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    this.access_token = data.access_token;
    return data.access_token;
  }

  private async getOpenID(code: string, access_token: string) {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${access_token}&code=${code}`;
    const res = await axios.get<any, AxiosResponse<TOpenID>>(url);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      openid: data.UserId,
    }
  }

  private async getUserInfo(access_token: string, openid: string) {
    const res = await axios.get<any, AxiosResponse<TUser>>(`https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${access_token}&userid=${openid}`);
    const data = res.data;
    if (data.errcode > 0) throw new HttpServiceUnavailableException(data.errmsg);
    return {
      account: 'wxw_' + data.userid, 
      avatar: data.avatar || data.thumb_avatar, 
      email: data.email, 
      nickname: data.name,
    }
  }
}