import 'reflect-metadata';
import { Logger } from 'log4js';
import { WebSocketServer } from 'ws';
import { RadoxProps, TNameSpace, TSendProps } from './interface';
import { Socket } from './socket';
import { ZooKeeper } from './zookeeper';
import { Agent } from './agent';
import { Container, interfaces } from 'inversify';
import { ServiceNameSpace, ClassMetaCreator, MethodMetaCreator, PublicNameSpace } from './annotates';
import { Exception } from '@nppm/toolkit';
import { parse, UrlWithParsedQuery } from 'url';
import { diff } from './utils';
import { EventEmitter } from 'events';
import { balances } from './balance';

export * from 'inversify';
export * from './annotates/service';
export * from './annotates/public';
export * from './agent';
export * from './socket';
export * from './zookeeper';
export * from './interface';
export * from './utils';

export class Radox extends EventEmitter {
  public  readonly container = new Container();
  public  readonly zookeeper: ZooKeeper;
  public  readonly namespaces = new Map<string, TNameSpace>();
  private readonly server: WebSocketServer;
  private readonly sockets = new Set<Socket>();
  private readonly agents = new Map<string, Agent>(); // 服务对应层 host:port
  private readonly interfaces = new Map<string, Set<string>>(); // interface对应层 command
  private readonly balance: TSendProps['balance'];
  private readonly logger: Logger;
  private installed = false;

  constructor(props: RadoxProps) {
    super();
    this.setMaxListeners(Infinity);
    this.balance = props.balance;
    this.logger = props.logger;
    this.server = new WebSocketServer({ port: props.port, maxPayload: Infinity });
    this.zookeeper = new ZooKeeper(props.zookeeper, props.port);
    this.zookeeper.on('change', (path: string, res: string[] = []) => this.onChange(path, res));
    this.server.on('connection', (socket, req) => {
      const _socket = new Socket(socket, this, props.logger);
      _socket.on('close', () => {
        this.removeSocket(_socket);
        this.emit('socket:disconnect', _socket, req);
      });
      this.sockets.add(_socket);
      this.emit('socket:connect', _socket, req);
    });
    this.zookeeper.on('reconnect', () => this.reconnectZookeeper());
    this.zookeeper.on('disconnect', () => this.disconnectZookeeper());
    this.zookeeper.on('expired', () => this.expriredZookeeper());
  }

  private async reconnectZookeeper() {
    if (!this.installed) return;
    await this.createZookeeperPathes();
    Array.from(this.interfaces.keys()).forEach(key => {
      this.zookeeper.fetch(key).then(res => {
        this.onChange(key, res);
      })
    });
    this.emit('zk:reconnect');
  }

  private disconnectZookeeper() {
    this.emit('zk:disconnect');
  }

  private expriredZookeeper() {
    this.emit('zk:expired');
  }

  public removeSocket(socket: Socket) {
    if (this.sockets.has(socket)) {
      this.sockets.delete(socket);
    }
  }

  private onChange(path: string, res: string[]) {
    if (this.interfaces.has(path)) {
      const objs = res.map(path => parse(path, true)); // urls
      const namespace = this.interfaces.get(path); // Set<hp>
      const a = Array.from(namespace.values()); // hp[]
      const b = objs.map(obj => Agent.makeCode(obj)); // hp[]
      const { removes, commons, adds } = diff(a, b); // hp[]
      removes.forEach(id => this.removeAgent(id)); // id: hp
      commons.forEach(id => this.updateAgent(id, objs.find(obj => Agent.makeCode(obj) === id))); // id: hp
      adds.forEach(id => this.addAgent(objs.find(obj => Agent.makeCode(obj) === id))); // id: hp
      this.interfaces.set(path, new Set(b));
    }
  }

  private removeAgent(id: string) {
    if (this.agents.has(id)) {
      const agent = this.agents.get(id);
      this.agents.delete(id);
      agent.destroy();
      this.emit('zk:delete:agent', agent);
    }
  }

  private updateAgent(id: string, state: UrlWithParsedQuery) {
    if (this.agents.has(id)) {
      const agent = this.agents.get(id);
      agent.update(state);
      this.emit('zk:update:agent', agent);
    }
  }

  private addAgent(state: UrlWithParsedQuery) {
    const agent = this.createAgent(state);
    this.emit('zk:insert:agent', agent);
  }

  public define<T>(clazz: interfaces.Newable<T>) {
    const instance = ClassMetaCreator.instance(clazz)
    if (instance.has(ServiceNameSpace) && !this.container.isBound(clazz)) {
      const namespace: string = instance.get(ServiceNameSpace);
      const methods = this.methods(clazz);
      this.container.bind(clazz).toSelf().inSingletonScope();
      this.namespaces.set(namespace, {
        target: clazz,
        methods: methods,
        path: this.zookeeper.toProviderPath(namespace, methods),
      });
    }
    return this;
  }

  private methods<T>(clazz: interfaces.Newable<T>) {
    return Object.getOwnPropertyNames(clazz.prototype).filter(name => {
      if (name === 'constructor') return false;
      if (typeof clazz.prototype[name] !== 'function') return false;
      const obj = Object.getOwnPropertyDescriptor(clazz.prototype, name);
      const instance = MethodMetaCreator.instance(obj);
      return instance.has(PublicNameSpace) && !!instance.get(PublicNameSpace);
    });
  }

  public async execute(command: string, value: any[]): Promise<any> {
    if (!value.length) throw new Exception(1003, 'miss method');
    if (!this.namespaces.has(command)) throw new Exception(1004, 'can not find the command of ' + command);
    const namespace = this.namespaces.get(command);
    const [method, ...args] = value;
    if (!namespace.methods.includes(method)) throw new Exception(1005, 'can not find the method of ' + method);
    return await Promise.resolve(this.container.get(namespace.target)[method](...args));
  }

  public async listen() {
    await this.zookeeper.connect();
    await this.createZookeeperPathes();
    this.installed = true;
  }

  private async createZookeeperPathes() {
    const pathes: string[] = [];
    try {
      for (const [, { path }] of this.namespaces) {
        await this.zookeeper.create(path);
        pathes.push(path);
      }
    } catch (e) {
      for (let i = 0; i < pathes.length; i++) {
        await this.zookeeper.remove(pathes[i]);
      }
      throw e;
    }
  }

  public async close() {
    for (const socket of this.sockets) {
      socket.close();
    }
    for (const [, agent] of this.agents) {
      agent.destroy();
    }
    this.agents.clear();
    this.interfaces.clear();
    await Promise.all(Array.from(this.namespaces.values()).map(({ path }) => {
      return this.zookeeper.remove(path).catch(e => this.logger.error(e.message));
    }));
    this.zookeeper.close();
    this.server.close();
  }

  public send(options: TSendProps) {
    return this._send(options.command, options.method, options.arguments, false, options.balance, options.timeout);
  }

  public sendback(options: TSendProps) {
    return this._send(options.command, options.method, options.arguments, true, options.balance, options.timeout);
  }

  private createAgent(state: UrlWithParsedQuery) {
    const agent = new Agent(state, this.logger);
    if (!this.agents.has(agent.id)) {
      agent.on('close', () => this.emit('agent:close', agent));
      agent.on('open', () => this.emit('agent:open', agent));
      agent.on('error', (e: any) => this.emit('agent:error', e, agent));
      this.agents.set(agent.id, agent);
    }
    return agent;
  }

  private async _send(command: string, method: string, args: any[], backable?: boolean, balance?: TSendProps['balance'], timeout?: number) {
    const path = this.zookeeper.watchPath(command);
    if (this.interfaces.has(path)) {
      const ids = Array.from(this.interfaces.get(path).values());
      const agents = ids.map(id => this.agents.get(id));

      return await this.invoke(agents, command, method, args, backable, balance);
    } else {
      // pathes: 取得当前zookeeper上面的所有匹配的providers
      const pathes = await this.zookeeper.fetch(path);

      // objs: 格式化所有取得的路径信息
      const objs = pathes.map(path => parse(path, true));

      // res: 将所有服务押入agents，同时返回部重复的agent的ID
      const res = Array.from(new Set(objs.map(obj => {
        const agent = this.createAgent(obj);
        return agent.id;
      })).values());

      // 将当前的interface名与服务的ID关联
      if (this.interfaces.has(path)) {
        const chunks = this.interfaces.get(path);
        res.forEach(id => chunks.add(id));
      } else {
        this.interfaces.set(path, new Set(res));
      }

      // 获取具有当前method方法的第一个agent
      const agents = res.map(id => this.agents.get(id));

      return await this.invoke(agents, command, method, args, backable, balance, timeout);
    }
  }

  private async invoke(
    agents: Agent[], 
    command: string, 
    method: string, 
    args: any[], 
    backable?: boolean, 
    balance?: TSendProps['balance'],
    timeout?: number,
  ): Promise<any> {
    const getBalance = balances[balance || this.balance || 'default'];
    const agent = getBalance(agents, method);

    // 递归判断是否有效
    const next = async (_agent: Agent) => {
      const _agents = agents.slice(0);
      const index = _agents.indexOf(_agent);
      if (index > -1) {
        _agents.splice(index, 1);
      }
      if (!_agents.length) throw new Exception(1104, 'cannot find any agents', command, method, args);
      return await this.invoke(_agents, command, method, args, backable, balance);
    }

    // 错误捕获
    const onerror = (e: Exception) => {
      if ([1001].includes(e.code)) {
        return next(agent);
      }
      return Promise.reject(e);
    }

    if (!agent) {
      throw new Exception(1104, 'cannot find any agents', command, method, args);
    }

    return backable 
      ? await agent.sendback(command, method, args, timeout).catch(onerror)
      : await agent.send(command, method, args, timeout).catch(onerror);
  }
}