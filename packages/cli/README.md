# @nppm/cli

NPPM官方支持的命令行工具

## Usage

```bash
$ npm i -g @nppm/cli
```

## Registry

源操作

```bash
# 新增源
$ npc registry -t a

# 选择源
$ npc registry -t c

# 删除源
$ npc registry -t d

# 查看源
$ npc registry
# 或者
$ npc registry -t q
```

## NPM Command

支持所有NPM命令，本工具将做命令转发

```bash
$ npc publish
$ npc login
$ npc info <package>
```