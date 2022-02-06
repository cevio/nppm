---
home: true
heroImage: https://static.npmjs.com/attachments/ck3uwed1cmso79y74pjugy10f-gak-2x.png
heroText: NPPM
tagline: Node Private Package Manager
actionText: 快速上手 →
actionLink: /guider.md
features:
- title: 简易部署
  details: 一键安装、一键升级，可视化安装本服务，提供丰富的后台配置，即改即生效。
- title: 轻量服务
  details: 专注于提供私有包服务不参杂其他NPM实时同步功能，保障系统稳定与轻量。
- title: 兼容性强
  details: 兼容NPM默认登录方式和第三方登录方式，同时兼容NPM不同版本的API。
- title: 插件化
  details: 提供强大的插件嵌入功能和服务事件功能，供开发者自定义企业级应用功能。
- title: 可视化
  details: 提供强大的可视化管理，增强用户体验，管理员轻松管理系统。
- title: 统计化
  details: 日榜、周榜、月榜，提供实时数据统计，便于了解模块热度。
---

**直接启动**

```bash
$ npm i -g @nppm/npm # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ nppm --port=3000 # 启动服务
```

**进程守护**

```bash
$ npm i -g @nppm/npm pm2 # 安装命令
$ cd <dictionary> # 需要确定一个目录来存放资源
$ pm2 start nppm -- --port=3000 # 启动服务
```

::: slot footer
MIT Licensed | Copyright © 2018-present [Evio Shen](https://github.com/cevio)
:::