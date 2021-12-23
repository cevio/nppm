import { Service, Public } from '@nppm/radox';
import { Worker } from '@nppm/process';
import { resolve } from 'url';
import axios, { AxiosResponse } from 'axios';
import { Exception } from '@nppm/toolkit';
import { createHmac } from 'crypto';
import { TUserID, TAccessToken, TOpenID, TUserInfo, TResult } from './interface';

@Service('com.nppm.login.dingtalk.service')
export class DingTalkService {
  private readonly appid = 'dingoauqykufg1t7afqmtp';
  private readonly appkey = 'dingr6eh1fizaidjmhpk';
  private readonly appsecret = 'v1BQiOoONRDWP4xlN27BJQajXCU46sjfjgf6RaKnTBpDXrzKfIvLKkXQTxYUFUj8';
  private readonly appidsecret = 'Kkqsdt8mHALUkPmTMH6go2XB_OxGN6Yoa2ktxNuRgVe1wp7c988Plx6j-KecyChO';

  private readonly stacks = new Map<string, { status: number, data: TResult, msg: string, timer: NodeJS.Timer }>();

  get radox() {
    return Worker.radox.value;
  }

  @Public()
  public async task(options: { query: { code: string, state: string } }) {
    const state = this.stacks.get(options.query.state);
    try {
      const access_token = await this.getAccessToken();
      state.status = 1;
      const { unionid, openid } = await this.getOpenID(options.query.code);
      state.status = 2;
      const userid = await this.getUserId(access_token, unionid);
      state.status = 3;
      const user = await this.getUserInfo(access_token, userid);
      state.status = 4;
      state.data = Object.assign({}, user, { token: openid });
    } catch(e) {
      state.status = -1;
      state.msg = e.message;
    }
  }

  @Public()
  public auth(session: string, domain: string) {
    const redirect_url = encodeURIComponent(resolve(domain, '/~/v1/login/dingtalk/task'));
    const timer = setTimeout(() => {
      if (this.stacks.has(session)) {
        this.stacks.delete(session);
      }
    }, 5 * 60 * 1000);

    this.stacks.set(session, {
      status: 0,
      data: null,
      msg: null,
      timer,
    });
    
    return {
      url: `https://oapi.dingtalk.com/connect/qrconnect?appid=${this.appid}&response_type=code&scope=snsapi_login&state=${session}&redirect_uri=${redirect_url}`,
    }
  }

  @Public()
  public check(session: string) {
    if (!this.stacks.has(session)) return { code: 0 };
    const state = this.stacks.get(session);
    switch (state.status) {
      case 4: 
        clearTimeout(state.timer);
        this.stacks.delete(session);
        return { code: 1, data: state.data };
      case -1:
        clearTimeout(state.timer);
        this.stacks.delete(session);
        return { code: -1, msg: state.msg };
      default: return { code: 0 };
    }
  }

  private async getAccessToken() {
    const res = await axios.get<any, AxiosResponse<TAccessToken>>(`https://oapi.dingtalk.com/gettoken?appkey=${this.appkey}&appsecret=${this.appsecret}`);
    const data = res.data;
    if (data.errcode > 0) throw new Exception(5000, data.errmsg);
    return data.access_token;
  }

  private async getOpenID(code: string) {
    const timestamp = Date.now();
    const signature = this.signature(timestamp, this.appidsecret);
    const url = `https://oapi.dingtalk.com/sns/getuserinfo_bycode?accessKey=${this.appid}&timestamp=${timestamp}&signature=${signature}`;
    const res = await axios.post<any, AxiosResponse<TOpenID>>(url, {
      tmp_auth_code: code
    });
    const data = res.data;
    if (data.errcode > 0) throw new Exception(5000, data.errmsg);
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
    if (data.errcode > 0) throw new Exception(5000, data.errmsg);
    return data.userid;
  }

  private async getUserInfo(access_token: string, userid: string) {
    const res = await axios.get<any, AxiosResponse<TUserInfo>>(`https://oapi.dingtalk.com/user/get?access_token=${access_token}&userid=${userid}`);
    const data = res.data;
    if (data.errcode > 0) throw new Exception(5000, data.errmsg);
    return {
      account: 'dingtalk' + data.userid, 
      avatar: data.avatar, 
      email: data.email, 
      nickname: data.name,
    }
  }
}