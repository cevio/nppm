---
sidebar: auto
sidebarDepth: 2
prev: ./plugin.md
next: false
---

# 事件集合

## config:update

```ts
import { ConfigEntity } from '@nppm/entity';
npmcore.on('config:update', (configs: ConfigEntity) => {
  // ...
})
```

## owner:update

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

```ts
import { VersionEntity } from '@nppm/entity';
npmcore.on('download', (version: VersionEntity) => {
  // ...
})
```

## publish

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('publish', (pack: PackageEntity) => {
  // ...
})
```

## unpublish

```ts
import { PackageEntity, VersionEntity } from '@nppm/entity';
npmcore.on('unpublish', (pack: PackageEntity, version?: VersionEntity) => {
  // ...
})
```

## deprecate

```ts
import { PackageEntity, VersionEntity } from '@nppm/entity';
npmcore.on('deprecate', (pack: PackageEntity, ...versions: VersionEntity[]) => {
  // ...
})
```

## star

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('star', (pack: PackageEntity) => {
  // ...
})
```

## unstar

```ts
import { PackageEntity } from '@nppm/entity';
npmcore.on('unstar', (pack: PackageEntity) => {
  // ...
})
```

## package:transfer

```ts
npmcore.on('package:transfer', (pkg: string, newUid: number, oldUid: number) => {
  // ...
})
```

## dist-tag:add

```ts
npmcore.on('dist-tag:add', (tag: string, vid: number) => {
  // ...
})
```

## dist-tag:delete

```ts
npmcore.on('dist-tag:delete', (tag: string, vid: number) => {
  // ...
})
```

## login

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('login', (user: UserEntity) => {
  // ...
})
```

## logout

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('logout', (user: UserEntity) => {
  // ...
})
```

## user:delete

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('user:delete', (user: UserEntity) => {
  // ...
})
```

## user:forbidden

```ts
import { UserEntity } from '@nppm/entity';
npmcore.on('user:forbidden', (user: UserEntity, status: boolean) => {
  // ...
})
```