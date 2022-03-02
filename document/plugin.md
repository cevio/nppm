---
sidebar: auto
sidebarDepth: 3
next: ./events.md
prev: ./setting.md
---

# 插件

插件能力为整站提供内置功能，包括第三方登录功能。在讲解插件化之前我们需要理解下NPPM的整站架构。

1. 插件入口
1. AOT + IOC 设计理念
1. Radix Tree 路由
1. Login Modal 机制
1. Event Emitter 事件通知机制

## 设计理念

[TypeService](https://github.com/cevio/typeservice) 封装了完整的HTTP请求，NPPM采用这个库编写。通过路口函数的执行与返回的函数作为插件的生命周期，类似于`react`组件机制。

### Plugin Enterence

入口函数，需要将整个模块通过`export default`导出此函数才能生效。入口函数构造体类型如下：

```ts
type EnterenceCallback = (npmcore: NPMCore) => Promise<() => Promise<void>>
```

我们也兼容Promise模式与非Promise模式，入口函数返回的函数将呗作为生命周期的销毁阶段处理函数。

```ts
// index.ts
import { NPMCore } from '@nppm/core';
export default async function DemoApplication(npmcore: NPMCore) {
  // namespace: 当前插件名
  // 插件启动代码
  return async () => {
    // 插件卸载代码
  }
}
```

### AOT + IOC

- `AOT` 装饰器模式。基于模块 [reflect-metadata](https://www.npmjs.com/package/reflect-metadata)
- `IOC` 依赖注入模型。基于模块 [inversify](https://www.npmjs.com/package/inversify)

类似于`nestjs`写法，我们通过`class`编写服务。

```ts
// test.service.ts
import { HTTPController } from '@typeservice/http';
import { NPMCore } from '@nppm/core';
import { inject } from 'inversify';
@HTTPController()
export class DEMOService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  // 数据库连接对象
  get connection() {
    return this.npmcore.orm.value;
  }

  // redis连接对象
  get redis() {
    return this.npmcore.redis.value;
  }

  // ... 服务代码
}
```

### Radix Tree Router

我们采用[find-my-way](https://github.com/delvedor/find-my-way)这个库，性能很高，而且可以动态注册路由。当然，在`TypeService`中已经被封装。

```ts
// test.service.ts
import { HTTPController, HTTPRouter, HTTPRequestParam, HTTPRequestQuery, HTTPRequestBody, HTTPRequestState } from '@typeservice/http';
import { NPMCore } from '@nppm/core';
import { inject } from 'inversify';
import { UserEntity } from '@nppm/entity';
@HTTPController()
export class DEMOService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  // 数据库连接对象
  get connection() {
    return this.npmcore.orm.value;
  }

  // redis连接对象
  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/~/test-modal/:pkg',
    methods: 'POST' // GET POST PUT DELETE ...
  })
  public postSomething(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestQuery('write') write: string,
    @HTTPRequestBody() body: any,
    @HTTPRequestState('user') state: UserEntity,
  ) {
    // pkg   指向 /~/test-modal/:pkg 中的pkg变量
    // write 指向 URLQuery 上的参数 write
    // body  指向 post 请求过来的body体
    // user  指向 koa.context(ctx) 中的 state 上的 user 参数

    // 可以 使用 this.connection 的所有功能 参考 ·typeorm· 文档使用
    // 可以 使用 this.redis 的所有功能
    // 逻辑处理代码 ... 略

    // 返回的数据将被认为是HTTP Response数据
    return {
      pkg, write, body, state
    }
  }

  // 其他路由 ...
}
```

以上为一个简单的服务，我们需要将此服务注册，那么我们需要使用以下代码：

```ts {5}
// index.ts
import { NPMCore } from '@nppm/core';
import { DEMOService } from './test.service';
export default async function DemoApplication(npmcore: NPMCore) {
  const unRegister = npmcore.http.value.createService(DEMOService);
}
```

系统将自动注入路由，同时自动处理IOC依赖。当卸载插件的时候，我们可以通过以下方法取消注册：

```ts {7}
// index.ts
import { NPMCore } from '@nppm/core';
import { DEMOService } from './test.service';
export default async function DemoApplication(npmcore: NPMCore) {
  const unRegister = npmcore.http.value.createService(DEMOService);
  return async () => {
    unRegister();
  }
}
```

### Login Modal

创建一个新的第三方登录对象。NPM第三方登录需要确定2个参数。

1. `loginUrl` 登录链接 NPM 将自动打开浏览器让用户登录。
2. `doneUrl` NPM通过一个回调函数返回登录信息，这个函数也将用户监测登录状态。

```ts
const login = npmcore.createLoginModule(namespace)
.addLoginURL(session => {
  // 通过传入的session返回一个字符串登录链接
  // 命令行将自动调用系统浏览器打开这个链接
  // 等待登录用户扫码或者其他操作
  return '...';
})
.addDoneUrl(session => {
  // 返回登录信息，数据结构如下
  return {
    account: string; // 账号
    avatar: string; // 头像
    email: string; // 邮箱
    nickname: string; // 昵称
    token: string; // 登录token，唯一
  }
});
```

然后，我们需要将此对象注入到NPPM内部

```ts
const loginObject = npmcore.addLoginModule(login);
```

在插件卸载的时候，我们需要取消这个对象的注册

```ts
npmcore.removeLoginModule(loginObject);
```

第三方登录的插件，系统会缓存一些redis信息，在登录完成后需要调用特殊的API去清除这些信息。请使用以下方式清除：

```ts
throw await this.npmcore.setLoginAuthorize(state);
```

> 具体请参考我们的第三方插件代码 [dingtalk](https://github.com/cevio/nppm/blob/master/packages/dingtalk/src/service.ts#L43)


### Event Emitter

事件流通知，在NPPM自动处理任务的时候抛出，供插件捕获后自定义事件处理。比如：

```ts
const register = pkg => {
  // 发布模块的事件通知
  // 自定义处理行为
}
npmcore.on('publish', register)
```

在插件卸载的时候，我们需要取消注册这个事件。

```ts
npmcore.off('publish', register)
```

当然，NPPM提供了很多事件，请参考事件列表。

## 中间件

NPPM提供了一些中间件，可供插件编写过程中使用。你也可以自定义中间件。中间件模型为koa的中间件。

1. `controller` 中间件
2. `method` 中间件

```ts {12,18}
import { 
  HTTPController, 
  HTTPRouter, 
  HTTPRequestParam, 
  HTTPRequestQuery, 
  HTTPRequestBody, 
  HTTPRequestState, 
  HTTPControllerMiddleware,
  HTTPRouterMiddleware
} from '@typeservice/http';
@HTTPController()
@HTTPControllerMiddleware(async (ctx, next) => await next())
export class DEMOService {
  @HTTPRouter({
    pathname: '/~/test-modal/:pkg',
    methods: 'POST' // GET POST PUT DELETE ...
  })
  @HTTPRouterMiddleware(async (ctx, next) => await next())
  public postSomething(
    @HTTPRequestParam('pkg') pkg: string,
    @HTTPRequestQuery('write') write: string,
    @HTTPRequestBody() body: any,
    @HTTPRequestState('user') state: UserEntity,
  ) {
    return {
      pkg, write, body, state
    }
  }
}
```

具体中间件写法请参考[这里](http://koajs.cn/)

### NpmCommanderLimit

用于限制当前请求对应的NPM命令中间件，如果在指定的命令中才会通过，否则将呗拒绝。

```ts
import { NpmCommanderLimit } from '@nppm/utils';
@HTTPRouterMiddleware(NpmCommanderLimit('login', 'install'));
// 只允许`login` `install` 命令通过
```

### OnlyRunInCommanderLineInterface

只允许命令行的请求通过

```ts
import { OnlyRunInCommanderLineInterface } from '@nppm/utils';
@HTTPRouterMiddleware(OnlyRunInCommanderLineInterface);
```

### createNPMErrorCatchMiddleware

对NPM命令行的请求进行错误格式化处理，让其符合NPM Response的规范。

```ts
import { createNPMErrorCatchMiddleware } from '@nppm/utils';
@HTTPRouterMiddleware(createNPMErrorCatchMiddleware);
```

### UserInfoMiddleware

获取当前连接的用户信息

```ts
import { UserInfoMiddleware } from '@nppm/utils';
@HTTPRouterMiddleware(UserInfoMiddleware);
// 用户信息将被保存在 ctx.state.user中
// 所以我们在获取当前用户信息的时候需要使用 
// `@HTTPRequestState('user') state: UserEntity` 来获取
```

### UserMustBeLoginedMiddleware

用户必须是登录态

```ts
import { UserMustBeLoginedMiddleware } from '@nppm/utils';
@HTTPRouterMiddleware(UserMustBeLoginedMiddleware);
```

> 请优先注册 `@HTTPRouterMiddleware(UserInfoMiddleware)`

### UserNotForbiddenMiddleware

用户必须是未被禁止登录的用户

```ts
import { UserNotForbiddenMiddleware } from '@nppm/utils';
@HTTPRouterMiddleware(UserNotForbiddenMiddleware);
```

> 请优先注册 `@HTTPRouterMiddleware(UserInfoMiddleware)`

### UserMustBeAdminMiddleware

用户必须是管理员登录的用户

```ts
import { UserMustBeAdminMiddleware } from '@nppm/utils';
@HTTPRouterMiddleware(UserMustBeAdminMiddleware);
```

> 请优先注册 `@HTTPRouterMiddleware(UserInfoMiddleware)`

## 插件元信息

每个插件都是一个NPM包，那么我们就需要对`package.json`约定以暴露插件的信息。在基本npm包信息的基础上需要增加如下配置：

```json
{
  "plugin_name": "插件名称",
  "plugin_icon": "插件图标地址",
  "devmain": "开发时候启动的文件路径",
  "nppm": true, // 必须为true
  "plugin_configs": TPluginConfigs[] // 插件的全局配置，可以在系统可视化界面中配置
}
```

### plugin_configs

按照一定数据格式来配置参数，可视化界面将会正确显示配置项:

```ts
export type TPluginConfigs<T = any> = TPluginConfigInput<T> | TPluginConfigSelect<T> | TPluginConfigRadio<T> | TPluginConfigSwitch | TPluginConfigCheckbox<T>;
export interface TPluginConfigBase<T = any> {
  key: string,
  value: T,
  title: string,
}
export interface TLabelValue<T = any> {
  label: string,
  value: T
}
```

> 当然，你也可以不必配置这个参数，表示这个插件无参数配置。

### TPluginConfigInput

```ts
export interface TPluginConfigInput<T> extends TPluginConfigBase<T> {
  type: 'input',
  placeholder?: string,
  mode?: string,
  width?: number | string,
}
```

> mode 为input的type类型，比如 `number` `email` `tel` ...

### TPluginConfigSelect

```ts
export interface TPluginConfigSelect<T> extends TPluginConfigBase<T> {
  type: 'select',
  placeholder?: string,
  fields: TLabelValue<T>[],
  width?: number | string,
}
```

### TPluginConfigRadio

```ts
export interface TPluginConfigRadio<T> extends TPluginConfigBase<T> {
  type: 'radio',
  fields: TLabelValue<T>[],
}
```

### TPluginConfigSwitch

```ts
export interface TPluginConfigSwitch extends TPluginConfigBase<boolean> {
  type: 'switch',
  placeholder?: [string, string],
}
```

> placeholder 为 switch 的两种不同文本文案，比如 `['是', '否']`

### TPluginConfigCheckbox

```ts
export interface TPluginConfigCheckbox<T> extends TPluginConfigBase<T[]> {
  type: 'checkbox',
  fields: TLabelValue<T>[],
  span?: number,
  gutter?: number | [number, number],
}
```

> gutter 为 每个 checkbox 的间距，这里我们采用 `Row` `Col` 布局，所以gutter指 `Row` 的属性 `gutter` 
> 具体参考[这里](https://ant.design/components/grid-cn/#Row)

### npmcore.loadPluginState(pkg: string)

当我们设定好参数，那么我们需要在编写程序过程中使用这些参数。

```ts
const state = npmcore.loadPluginState(pkg);
// state 就是我们当前参数
// state: Record<string, any>
// pkg为当前插件 package.json 中的 name
```