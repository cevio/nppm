# NPPM

Node Private Package Manager. Document [here](https://cevio.github.io/nppm/)!

- `cli support` [@nppm/cli](https://github.com/cevio/nppm/tree/master/packages/cli)
- `Web project` [cevio/nppm-client](https://github.com/cevio/nppm-client)

特点：

1. 支持一键安装系统以及可视化系统配置，无需修改文件重启服务
1. 支持第三方登录：比如 企业微信 和 钉钉，也可以自建企业内部登录
1. 支持NPM网页端的登录，可以通过后台开关控制
1. 支持模块的下载权限控制，通过开关或者设置IP白名单
1. 支持后台随时添加或者删除scope命名空间
1. 支持后台随时添加公有源
1. 支持自由切换命令行的登录模式
1. 支持后台对用户的管理和用户的禁止登录以及管理员设定
1. 支持模块的管理员转让
1. 支持独立用户特定scope命名空间的设定
1. 支持NPM命令行90%功能，除`npm token`以及`npm hook`命令外
1. 支持搜索私有模块以及公有模块（与NPM官方相同）
1. 支持模块的收藏功能
1. 支持模块的下载量统计
1. 支持收藏和下载量的数据模块分析
1. 支持网页端提醒是否系统可以升级到最新
1. 支持系统的插件化


## Easy to start

direct start

```bash
$ npm i -g @nppm/npm # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ nppm --port=3000 # 启动服务
```

process daemon

```bash
$ npm i -g @nppm/npm pm2 # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ pm2 start nppm -- --port=3000 # 启动服务
```

## Easy to use

```bash
$ npm <command...> --registry=http://<host>:<port>
```