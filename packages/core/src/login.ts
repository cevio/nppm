export type TLoginHandler<T = any> = (session: string) => T | Promise<T>;
export interface TLoginResult {
  account: string,
  avatar: string,
  email: string,
  nickname: string,
  token: string,
}

export class Login {
  private _loginUrl: TLoginHandler<string>;
  private _doneUrl: TLoginHandler<TLoginResult>;
  constructor(public readonly namespace: string){}

  public addLoginURL(fn: TLoginHandler<string>) {
    this._loginUrl = fn;
    return this;
  }

  public addDoneUrl(fn: TLoginHandler<TLoginResult>) {
    this._doneUrl = fn;
    return this;
  }

  public authorize(session: string) {
    return Promise.resolve(this._loginUrl(session));
  }

  public checkable(session: string) {
    return Promise.resolve(this._doneUrl(session));
  }
}