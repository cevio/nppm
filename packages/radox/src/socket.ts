import WebSocket from "ws";
import { Logger } from 'log4js';
import { Messager } from '@nppm/toolkit';
import { EventEmitter } from 'events';
import { Radox } from '.';
import { heatbeat } from './utils';
export class Socket extends EventEmitter {
  public readonly message: Messager;
  private readonly timer: NodeJS.Timer;
  private checking = false;
  constructor(
    private readonly websocket: WebSocket,
    private readonly radox: Radox,
    private readonly logger: Logger,
  ) {
    super();
    this.message = new Messager(logger);
    this.setMaxListeners(Infinity);
    const handler = this.message.createReceiver();
    this.websocket.on('message', handler);
    this.message.setSender(data => {
      this.websocket.send(JSON.stringify(data));
    })
    this.websocket.on('close', () => {
      this.websocket.off('message', handler);
      clearInterval(this.timer);
      this.close();
      this.emit('close');
    })
    this.message.onMessageWhenNotFound((command, value) => {
      return this.radox.execute(command, value);
    })
    this.timer = setInterval(() => {
      if (this.checking) return;
      const now = Date.now();
      if (now - this.message.last_read_time > heatbeat || now - this.message.last_write_time > heatbeat) {
        const resolve = () => {
          this.websocket.off('pong', resolve);
          clearTimeout(timer);
          this.checking = false;
          this.message.last_read_time = Date.now();
        }
        this.checking = true;
        this.websocket.on('pong', resolve)
        this.websocket.ping();
        this.message.last_write_time = Date.now();
        const timer = setTimeout(() => {
          this.websocket.terminate();
          this.logger.warn('wsocket terminate over ' + heatbeat * 3);
        }, heatbeat * 3);
      }
    }, 1000);
  }

  get connection() {
    return this.websocket;
  }

  public close() {
    // this.websocket.close();
    this.message.disable();
  }
}