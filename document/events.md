---
sidebar: auto
sidebarDepth: 2
prev: ./plugin.md
next: false
---

# 事件集合

## config:update

系统配置更新时候触发

```ts
import { ConfigEntity } from '@nppm/entity';
npmcore.on('config:update', (configs: ConfigEntity) => {
  // ...
})
```

## owner:update

模块更新maintainer时候触发

```ts
import { PackageEntity } from '@nppm/entity';
interface TPackageMaintainerState {
  name: string,
  email: string,
}
npmcore.on('owner:update', (pack: PackageEntity, maintainers: TPackageMaintainerState[]) => {
  // ...
})
```

## download

模块被下载时候触发

```ts
import { VersionEntity } from '@nppm/entity';
npmcore.on('download', (version: VersionEntity) => {
  // ...
})
```

## publish

模块版本被发布时候触发

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('publish', (pack: PackageEntity) => {
  // ...
})
```

## unpublish

模块被删除时候触发，如果有`version`，表示删除单个模块版本，否则是删除整个模块

```ts
import { PackageEntity, VersionEntity } from '@nppm/entity';
npmcore.on('unpublish', (pack: PackageEntity, version?: VersionEntity) => {
  // ...
})
```

## deprecate

废弃模块版本时候触发

```ts
import { PackageEntity, VersionEntity } from '@nppm/entity';
npmcore.on('deprecate', (pack: PackageEntity, ...versions: VersionEntity[]) => {
  // ...
})
```

## star

点赞时候触发

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('star', (pack: PackageEntity) => {
  // ...
})
```

## unstar

取消点赞时候触发

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('unstar', (pack: PackageEntity) => {
  // ...
})
```

## package:transfer

模块管理员转让时候触发

```ts
npmcore.on('package:transfer', (pkg: string, newUid: number, oldUid: number) => {
  // ...
})
```

## dist-tag:add

模块 tag 被增加时候触发

```ts
npmcore.on('dist-tag:add', (tag: string, vid: number) => {
  // ...
})
```

## dist-tag:delete

模块 tag 被删除时候触发

```ts
npmcore.on('dist-tag:delete', (tag: string, vid: number) => {
  // ...
})
```

## login

用户登录时候触发

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('login', (user: UserEntity) => {
  // ...
})
```

## logout

用户退出登录时候触发

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('logout', (user: UserEntity) => {
  // ...
})
```

## user:delete

用户被软删除时候触发

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('user:delete', (user: UserEntity) => {
  // ...
})
```

## user:forbidden

用户被禁止登录时候触发

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('user:forbidden', (user: UserEntity, status: boolean) => {
  // ...
})
```