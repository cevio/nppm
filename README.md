# COM.CRAWLER

爬虫调度服务

## 直播服务

```bash
# installer
$ npc i -g @node/com.express @node/com.crawler @node/com.strategies.live @node/com.live.cli @node/com.carry.wx @node/com.carry.aiguang @node/com.carry.youzan && @node/com.carry.mokuai

# live one
$ npc i -g @node/com.express @node/com.crawler @node/com.carry.wx @node/com.carry.aiguang @node/com.carry.youzan @node/com.carry.mokuai
# live two
$ npc i -g @node/com.strategies.live @node/com.live.cli

# bootstrap
$ com.express && com.crawler && com.strategies.live && com.carry.wx && com.carry.aiguang && com.carry.youzan && com.carry.mokuai

# live one
$ com.express && com.crawler && com.carry.wx && com.carry.aiguang && com.carry.youzan && com.carry.mokuai
# live two 
$ com.strategies.live
```

## 短视频服务

```bash
# installer
$ npc i -g @node/com.express @node/com.crawler @node/com.strategies.finder @node/com.strategies.finder.vip @node/com.strategies.finder.old

# bootstrap
$ com.express && com.crawler && com.strategies.finder 
$ com.strategies.finder.vip && com.strategies.finder.old
```

## ERROR CODE

错误码归类

- `4104` 在爬虫子进程中，发起了创建爬虫的任务后爬虫未连接的时候发起请求导致报错
- `4108` 由于服务器原因，创建爬虫进程未得到响应而超时
- `4004` 没有可用的爬虫
- `1003` Radox获取到的请求中，参数个数不正确
- `1004` Radox获取到的请求中，找不到该interface类
- `1005` Radox获取到的请求中，找不到该interface类中的方法
- `1104` Radox发送请求过程中，找不到agent对象
- `1106` zk断开连接
- `1202` 消息体传输通道被关闭, 原因可能是连接已关闭
- `1208` 底层请求传输超时，持久未得到响应
- `1304` 系统捕获到未知的命令
- `1001` ws链接失败
- `3001` com.baizhun.crawler.strategies.finder.service cookie池为空
- `3002` com.baizhun.crawler.strategies.finder.service 服务被停止
- `3003` com.baizhun.crawler.live.*.service 服务缺少username参数
- `3004` com.baizhun.crawler.live.*.service 注册主服务失败
- `3005` 商品数据报错

## Nacos config interface

```ts
interface TNacosConfigs {
  spider: {
    browserSocketPath: string, // websocket 链接路径
    androidJoinPath: string, // android 链接路径
    max: number, // 配置单位周期内最大爬虫消耗资源个数
    expire: number, // 配置爬虫次数缓存周期
  },
  kafka: string,
  zookeeper: string,
  axios_prefix: string, // 爬虫策略等一系列需要用到的SQL请求的HTTP地址前缀
  express: {
    host: string, // 网关host
    port: number, // 网关 port
    token: string, // 网关认证 token
  },
  redis: {
    host: string,
    port: number,
    password: string,
    db: number
  },
  pg: {
    user: string,
    host: string,
    port: number,
    database: string,
    password: string,
  }
}
```

## Packages

各包描述

### @node/com.crawler

爬虫请求调度服务以及爬虫子进程服务

#### 主进程微服务

**interface:** com.baizhun.crawler.schedule

Methods:

1. `createCrawler(namespace: string, version: string)` 创建爬虫
2. `execute(command: string, value: any[])` 执行爬虫命令 调度

#### 子进程微服务

**interface:** com.baizhun.crawler.proxy

Methods:

1. `execute(command: string, value: any[] = [])` 执行爬虫命令
2. `live(data: any)` 转发直播数据


### @node/com.express

爬虫网关服务

**interface:** com.baizhun.crawler.express

Methods:

1. `activeLiveWebsocketState(state: TActiveLiveWebsocketState)` 转发传输直播数据到直播大屏
2. `crawlerCommandExecuteSuccess(namespace: string)` 爬虫命令成功+1
3. `crawlerCommandExecuteFaild(namespace: string)` 爬虫命令失败+1

### @node/com.live.cli

直播命令行工具，生成直播进程后会自动挂载微服务

**interface:** {username: string}

Methods:

1. `addWatcher(wid: number, duration: number)` 添加订单监控信息
2. `grafting(time?: number)` 自动嫁接方法
3. `transformDataFlows(token: string, state: any)` 接受直播传输数据

### @node/com.strategies.finder

爬虫创作者信息与视频爬取服务

**interface:** com.baizhun.crawler.strategies.finder.service

Methods:

1. `start()` 开始任务
2. `stop()` 结束任务
3. `push(...state: TGetUseResponseState[])` 额外推入爬取的数据源

### @node/com.strategies.finder.vip

特殊爬虫创作者信息与视频爬取服务 现指海尔项目

**interface:** com.baizhun.crawler.strategies.finder.vip.service

Methods:

1. `start()` 开始任务
2. `stop()` 结束任务

### @node/com.strategies.finder.old

过期爬虫创作者信息与视频爬取服务

**interface:** com.baizhun.crawler.strategies.finder.old.service

Methods:

1. `start()` 开始任务
2. `stop()` 结束任务

### @node/com.strategies.live

爬虫直播策略启动关闭

**interface:** com.baizhun.crawler.strategies.live.service

Methods:

1. `start()` 开始任务
2. `stop()` 结束任务

### @node/com.carry.wx

直播商品爬虫之微信小商店及带货中心微服务

**interface:** com.baizhun.crawler.carry.wx

Methods:

1. `main(appId: string, pid: string, hostname: string)` 获取商品数据

### @node/com.carry.aiguang

直播商品爬虫之爱逛微服务

**interface:** com.baizhun.crawler.carry.aiguang

Methods:

1. `main(alias: string, guangBusinessId: string)` 获取商品数据

### @node/com.carry.youzan

直播商品爬虫之有赞微服务

**interface:** com.baizhun.crawler.carry.youzan

Methods:

1. `main(alias: string)` 获取商品数据

### @node/com.carry.mokuai

直播商品爬虫之魔筷微服务

**interface:** com.baizhun.crawler.carry.mokuai

Methods:

1. `main(crawler: string, item_id: string)` 获取商品数据