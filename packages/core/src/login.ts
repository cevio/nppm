export type TLoginHandler = (session: string) => string | Promise<string>;

export class Login {
  private _loginUrl: TLoginHandler;
  private _doneUrl: TLoginHandler;
  constructor(public readonly namespace: string){}

  public addLoginURL(fn: TLoginHandler) {
    this._loginUrl = fn;
    return this;
  }

  public addDoneUrl(fn: TLoginHandler) {
    this._doneUrl = fn;
    return this;
  }
}