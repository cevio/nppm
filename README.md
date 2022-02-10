# NPPM

Node Private Package Manager. Document [here](https://cevio.github.io/nppm/)!

> 请先别使用，因为还在更新中，项目暂完成80%。
> 预计在`react@18`发布后的几周后发布，原因是打算采用最新react架构作为前端架构（可能会考虑采用`react@18`的SSR渲染）。

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