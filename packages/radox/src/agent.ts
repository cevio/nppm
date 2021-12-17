import * as Websocket from 'ws';
import { Logger } from 'log4js';
import { EventEmitter } from 'events';
import { UrlWithParsedQuery } from 'url';
import { Exception, Messager } from '@nppm/toolkit';
import { heatbeat } from './utils';

interface TStack {
  data: {
    command: string, 
    value: any[],
  },
  backable: boolean,
  timeout?: number,
  resolve: (value?: any) => void,
  reject: (reason?: any) => void,
}

export class Agent extends EventEmitter {
  static makeCode(state: UrlWithParsedQuery) {
    return state.hostname + ':' + state.port;
  }
  private readonly message: Messager;
  private socket: Websocket = null;
  private getting = false;
  private readonly stacks = new Set<TStack>();
  private count = 0;
  private exception: Exception;
  private timer: NodeJS.Timer;
  private checking = false;

  private increase() {
    return ++this.count;
  }

  private decrease() {
    return ++this.count;
  }

  get hits() {
    return this.count;
  }

  constructor(
    private readonly state: UrlWithParsedQuery,
    private readonly logger: Logger,
  ) {
    super();
    this.message = new Messager(logger);
    this.setMaxListeners(Infinity);
  }

  get id() {
    return Agent.makeCode(this.state);
  }

  private startPingPong() {
    this.timer = setInterval(() => {
      if (this.checking) return;
      const now = Date.now();
      if (now - this.message.last_read_time > heatbeat || now - this.message.last_write_time > heatbeat) {
        const resolve = () => {
          this.socket.off('pong', resolve);
          clearTimeout(timer);
          this.checking = false;
          this.message.last_read_time = Date.now();
        }
        this.checking = true;
        this.socket.on('pong', resolve);
        this.socket.ping();
        this.message.last_write_time = Date.now();
        const timer = setTimeout(() => {
          this.logger.warn('agent destroy over ' + heatbeat * 3);
          this.destroy();
        }, heatbeat * 3);
      }
    }, 1000);
  }

  public destroy() {
    if (this.socket) {
      this.socket.close();
    }
    this.message.disable();
    this.stacks.clear();
  }

  public update(state: UrlWithParsedQuery) {
    this.state.query = state.query;
  }

  public hasMethod(method: string) {
    let methods = this.state.query.methods || [];
    if (!Array.isArray(methods)) {
      methods = [methods]
    }
    return methods.includes(method);
  }

  private getConnection() {
    return new Promise<Websocket>((resolve, reject) => {
      const ws = new Websocket('ws://' + this.id);
      const onerror = (e: any) => reject(new Exception(1001, e.message));
      ws.on('error', onerror);
      ws.on('close', () => {
        this.message.disable();
        this.socket = null;
        clearInterval(this.timer);
        this.emit('close');
      });
      ws.on('open', () => {
        ws.off('error', onerror);
        this.message.reset();
        this.message.setSender(data => ws.send(JSON.stringify(data)));
        ws.on('message', this.message.createReceiver());
        ws.on('error', e => this.emit('error', e));
        this.emit('open');
        resolve(ws);
      });
    })
  }

  private response() {
    const stacks = Array.from(this.stacks.values());
    this.stacks.clear();
    if (stacks.length) {
      stacks.forEach(stack => {
        if (this.exception) {
          return stack.reject(this.exception);
        }
        if (stack.backable) {
          this.message.sendback(stack.data.command, stack.data.value, stack.timeout)
            .then(stack.resolve)
            .catch(stack.reject);
        } else {
          try {
            this.message.send(stack.data.command, stack.data.value);
            stack.resolve();
          } catch(e) {
            stack.reject(e);
          }
        }
      })
    }
  }

  private polling() {
    if (!this.socket) {
      if (this.getting) return;
      this.getting = true;
      this.getConnection().then(connection => {
        this.socket = connection;
        this.startPingPong();
      }).catch(e => {
        this.exception = e;
      }).finally(() => {
        this.response();
        this.getting = false;
      })
    } else {
      this.response();
    }
  }

  public send(command: string, method: string, args: any[], timeout?: number) {
    this.increase();
    return new Promise((resolve, reject) => {
      if (this.exception) return reject(this.exception);
      this.stacks.add({
        data: {
          command,
          value: [method, ...args]
        },
        backable: false,
        timeout,
        resolve,
        reject,
      })
      this.polling();
    }).finally(() => this.decrease())
  }

  public sendback(command: string, method: string, args: any[], timeout?: number) {
    this.increase();
    return new Promise((resolve, reject) => {
      if (this.exception) return reject(this.exception);
      this.stacks.add({
        data: {
          command,
          value: [method, ...args]
        },
        backable: true,
        timeout,
        resolve,
        reject,
      })
      this.polling();
    }).finally(() => this.decrease())
  }
}