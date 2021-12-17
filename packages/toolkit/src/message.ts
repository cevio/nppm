// import { logger } from '.';
import { Exception } from './exception';
import { Task } from './task';
import { Logger } from 'log4js';

const defaultId = 1;

interface TCallbackState {
  resolve: (data: any) => void,
  reject: (e: any) => void,
}

interface TMessageState {
  id: number,
  mode: 0 | 1, // 0 请求 1 响应
  twoway?: boolean, // true 需要响应
  data: {
    request?: {
      command: string,
      value: any[],
    },
    response?: {
      data?: any,
      status: number,
      msg?: any[]
    }
  },
}

export class Messager extends Task {
  private sender: (data: TMessageState) => void;
  private id = defaultId;
  private readonly callbacks = new Map<number, TCallbackState>();
  public disabled = false;
  public last_read_time = Date.now();
  public last_write_time = Date.now();

  constructor(private readonly logger: Logger) {
    super();
  }

  public setSender(sender: (data: TMessageState) => void) {
    this.sender = sender;
    return this;
  }

  public disable() {
    this.id = defaultId;
    this.disabled = true;
    this.callbacks.clear();
  }

  public reset() {
    this.id = defaultId;
    this.disabled = false;
    this.callbacks.clear();
  }

  public send(command: string, value: any[] = []) {
    if (this.disabled) throw new Exception(1202, '消息体传输通道被关闭');
    this.sender({
      id: 0,
      mode: 0,
      twoway: false,
      data: {
        request: {
          command,
          value,
        }
      }
    })
    this.last_write_time = Date.now();
  }

  public sendback<T>(command: string, value: any[] = [], timeout: number = 15 * 60 * 1000) {
    if (this.disabled) return Promise.reject(new Exception(1202, '消息体传输通道被关闭'));
    let id = this.id++;
    if (id >= Number.MAX_SAFE_INTEGER) {
      id = this.id = defaultId;
    }

    return new Promise((resolve, reject) => {
      const _resolve = (state: T) => {
        clearTimeout(timer);
        resolve(state);
      }
      const _reject = (e: any) => {
        clearTimeout(timer);
        reject(e);
      }
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        _reject(new Exception(1208, command, value, timeout));
      }, timeout);
      this.callbacks.set(id, {
        resolve: _resolve,
        reject: _reject,
      });
      this.sender({
        id,
        mode: 0,
        twoway: true,
        data: {
          request: {
            command,
            value,
          }
        }
      });
      this.last_write_time = Date.now();
    })
  }

  public createReceiver() {
    return (request: string | Buffer | TMessageState) => {
      if (this.disabled) return;
      request = Buffer.isBuffer(request) ? Buffer.from(request).toString() : request;
      const req = typeof request === 'string' 
        ? JSON.parse(request) as TMessageState
        : request;

      this.last_read_time = Date.now();

      if (req.mode === 0) {
        // 收到请求
        this.emit(req.data.request.command, ...req.data.request.value)
          .then((res: any) => {
            if (req.twoway) {
              this.sender({
                id: req.id,
                mode: 1,
                twoway: false,
                data: {
                  response: {
                    data: res,
                    status: 200,
                  }
                }
              })
            }
          })
          .catch(e => {
            if (req.twoway) {
              this.sender({
                id: req.id,
                mode: 1,
                twoway: false,
                data: {
                  response: {
                    status: Exception.isException(e) ? e.code : 500,
                    msg: Exception.isException(e) ? e.messages : [e.message],
                  }
                }
              })
            } else {
              this.logger.error(e.message);
            }
          });
      } else if (req.mode === 1) {
        // 收到响应
        if (req.id && this.callbacks.has(req.id)) {
          const response = req.data.response;
          const injection = this.callbacks.get(req.id);
          this.callbacks.delete(req.id);
          if (response.status === 200) {
            injection.resolve(response.data);
          } else {
            injection.reject(new Exception(response.status, ...response.msg));
          }
        }
      } else {
        this.logger.error('unknow msg body:' + JSON.stringify(req));
      }
    } 
  }
}