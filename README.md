# NPPM

Node Private Package Manager. Document [here](https://cevio.github.io/nppm/)!

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