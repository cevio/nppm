---
sidebar: auto
sidebarDepth: 2
next: ./setting.md
prev: false
---

# 关于NPPM的前世今生

NPM私有源仓库，早在2019年我发布了第一个版本到现在，不断总结NPM的API后编写了这套轻量的，符合国内一般公司内部使用的程序。它经历了以下的周期：

1. [CPM](https://github.com/cevio/cpm) 2019年发布
2. [NILPPM](https://github.com/nilppm/npm) 2019年发布
3. [FLOWX-NPM](https://github.com/flowxjs/npm) 2020年发布
4. [NPPM](https://github.com/cevio/nppm) 2022年发布

期间不断与[cnpm](https://github.com/cnpm/cnpm)的原作者[苏千](https://github.com/fengmk2)交流，给我提供了很多思路和文档，让我可以对NPM Registry有更深入的了解。

有别于CNPM的是，NPPM采用非同步模块的方式，在国内，鉴于网络情况，通过配置registry集合即可以快速无缝切换到各种模块私有/公有源进行模块信息读取，比如说淘宝源（速度已经够快），我们的目标仅仅是对私有内部模块的管理，职责非常明确，而公有模块，交给各大公有源处理。

NPPM的特点是：

1. **简易部署：** 一键安装、一键升级，可视化安装本服务，提供丰富的后台配置，即改即生效。
2. **轻量服务：** 专注于提供私有模块管理服务，不参杂其他NPM实时同步功能，保障系统稳定与轻量。
3. **兼容性强：** 兼容NPM默认登录方式和第三方登录方式，同时兼容NPM不同版本的API。
4. **插件化强：** 提供强大的插件嵌入功能和服务事件功能，供开发者自定义企业级应用功能。

## 安装

如果公司内部使用私有源，那么必定看中的是安装方便与升级方便的能力。NPPM为了解决这个问题，我们采用命令式安装方式，因为NPM原本就提供了命令安装能力，那么如果我们将这套程序做成NPM包，同时使用命令启动，那么，恰好能够完美解决这个痛点。

> 安装前需要准备一个数据库和一个redis，数据库可以是`mysql` `postgres` `mongodb`等等，在可视化安装时候可以选择不同的支持的数据库类型。**注意：不支持winow服务器**

### 直接启动

不用clone仓库也不用修改任何代码，直接通过以下命令启动：

```bash
$ npm i -g @nppm/npm # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ nppm --port=3000 # 启动服务
```

### 进程守护

当然如果希望进程守护，比如使用PM2来管理，我们可以通过以下命令启动：

```bash
$ npm i -g @nppm/npm pm2 # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ pm2 start nppm -- --port=3000 # 启动服务
```

### 服务配置

当服务启动以后，你可以在`<dictionary>`在看到2个文件

- `<dictionary>/nppm-production.log` 日志文件
- `<dictionary>/package.json` 项目信息文件，插件安装信息会存放在这个文件内。

然后，你可以通过一下命令打开安装

```bash
$ open http://127.0.0.1:3000
```

之后就是安装可视化配置完毕即可使用。在命令行上指定当前registry地址即可，比如：

```bash
$ npm login --registry=http://127.0.0.1:3000
```

安装完毕后请前往 `/admin/settings` 路由设置整站。

## 升级

采用NPM包模式，那么我们很轻松进行整站升级：

```bash
$ npm i -g @nppm/npm@<version> # 你可以指定升级版本
```

然后重启服务：

```bash
$ nppm --port=3000
```

## 管理员

本系统第一个用户将默认为管理员，可以管理整站设置。当然，第一个管理员也可以通过`npm login`命令直接在命令行登录。

管理员权限：

1. 发布、管理任意私有包
2. 管理整站配置

当然，你也可以通过管理员账号对任意其他登录账号设置为管理员，以便多管理存在。

## 登录模式

我们默认提供NPM登录方式，用户名和密码登录。但是我们可以通过安装提供的插件来扩展第三方登录，比如`@nppm/dingtalk`使用钉钉登录，`@nppm/qywx`，使用企业微信登录。当然你也可以根据文档扩展第三方登录供公司内部使用。

## 数据统计

- 你可以在首页实时看到当前系统的各种数据，包含用户数、模块数、版本数以及下载次数等等。
- 我们也提供了最新更新的模块数据，以便大家查看更新私有模块。
- 我们也会输出各种数据榜单，供内部统计使用。包含日榜、周榜、月榜等等。

## 贡献代码/提问

你可以通过以下方式clone仓库提交PR来贡献代码：

```bash
$ git clone git@github.com:cevio/nppm.git
```

如果有任何问题，请前往 [https://github.com/cevio/nppm/issues](https://github.com/cevio/nppm/issues)