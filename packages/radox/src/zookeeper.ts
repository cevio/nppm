import * as zookeeper from 'node-zookeeper-client';
import { Client, CreateMode, Stat, Event } from 'node-zookeeper-client';
import { Exception, localhost } from '@nppm/toolkit';
import { format } from 'url';
import { EventEmitter } from 'events';

export class ZooKeeper extends EventEmitter {
  private readonly client: Client;
  private readonly port: number;
  private connected = false;
  constructor(host: string, port: number) {
    super();
    this.client = zookeeper.createClient(host);
    this.port = port;
    this.setMaxListeners(Infinity);
    this.client.on('state', state => {
      if (state === zookeeper.State.SYNC_CONNECTED) {
        this.connected = true;
        this.emit('reconnect');
      } else if (state === zookeeper.State.DISCONNECTED) {
        this.connected = false;
        this.emit('disconnect');
      } else if (state === zookeeper.State.EXPIRED) {
        this.connected = false;
        this.emit('expired');
      }
    })
  }

  public connect() {
    return new Promise<void>((resolve, reject) => {
      const handler = (err?: any) => {
        this.client.off('connected', handler);
        if (err) return reject(err);
        resolve()
      }
      this.client.on('connected', handler)
      this.client.connect();
    })
  }

  public close() {
    return this.client.close();
  }

  public toProviderPath(namespace: string, methods: string[]) {
    const obj = {
      protocol: "radox",
      slashes: true,
      host: localhost + ':' + this.port,
      pathname: '/' + namespace,
      query: {
        methods: methods.sort()
      }
    }
    const uri = format(obj);
    const interface_root_path = `/radox/${namespace}`;
    const interface_dir_path = interface_root_path + '/providers';
    const interface_entry_path = interface_dir_path + '/' + encodeURIComponent(uri);
    return interface_entry_path;
  }

  public toConsumerPath(namespace: string) {
    const obj = {
      protocol: "radox",
      slashes: true,
      host: localhost + ':' + this.port,
      pathname: '/' + namespace,
      query: {}
    }
    const uri = format(obj);
    const interface_root_path = `/radox/${namespace}`;
    const interface_dir_path = interface_root_path + '/consumers';
    const interface_entry_path = interface_dir_path + '/' + encodeURIComponent(uri);
    return interface_entry_path;
  }

  public async create(url: string) {
    if (!this.connected) throw new Exception(1106, 'zookeeper is not online');
    const sp = url.split('/');
    let path: string = '';
    for (let i = 1; i < sp.length; i++) {
      path = path + '/' + sp[i];
      const mode = i === sp.length - 1 
        ? CreateMode.EPHEMERAL 
        : CreateMode.PERSISTENT;
      await this._create(path, mode);
    }
  }

  private async _create(uri: string, mode: number) {
    if (!(await this.exists(uri))) {
      
      return await new Promise<string>((resolve, reject) => {
        this.client.create(uri, mode, (err, node) => {
          if (err) return reject(err);
          resolve(node);
        })
      })
    }
  }

  private exists(uri: string) {
    return new Promise<boolean>((resolve, reject) => {
      this.client.exists(uri, (err, stat) => {
        if (err) return reject(err);
        return resolve(!!stat);
      });
    });
  }

  public async remove(uri: string) {
    if (!this.connected) throw new Exception(1106, 'zookeeper is not online');
    if (await this.exists(uri)) {
      await new Promise<void>((resolve, reject) => {
        this.client.remove(uri, err => {
          if (err) return reject(err);
          resolve();
        })
      });
    }
  }

  public async query(path: string, feedback: (e: Event) => void) {
    if (!this.connected) throw new Exception(1106, 'zookeeper is not online');
    return await new Promise<string[]>((resolve, reject) => {
      const callback = (err: Error, children: string[], stat?: Stat) => {
        if (err) return reject(err);
        if (stat) return resolve(children);
        return reject(new Error('cannot find zookeeper path:' + path));
      };
      this.client.getChildren(path, (e) => feedback(e), callback);
    })
  }

  private watcher(e: Event): Promise<string[]> {
    if (e.type === 4) {
      return this.query(e.path, ex => this.watcher(e).then(res => {
        this.emit('change', ex.path, res);
      })).then(res => res.map(path => decodeURIComponent(path)));
    }
    return Promise.resolve([]);
  }

  public watchPath(command: string) {
    return `/radox/${command}/providers`
  }

  public fetch(path: string) {
    return this.watcher(new Event(4, 'NODE_CHILDREN_CHANGED', path));
  }
}