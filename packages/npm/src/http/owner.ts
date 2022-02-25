import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { In } from 'typeorm';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestParam } from '@typeservice/http';
import { createNPMErrorCatchMiddleware, NpmCommanderLimit, OnlyRunInCommanderLineInterface } from '@nppm/utils';
import { MaintainerEntity, PackageEntity, UserEntity } from '@nppm/entity';
import { HttpNotFoundException, HttpUnprocessableEntityException } from '@typeservice/exception';
import type { TPackageMaintainerState } from './maintainer';
import { HttpTransactionService } from '../transaction';
import { HttpMaintainerService } from './maintainer';
import { diff } from '../diff';
import { PackageCacheAble } from '@nppm/cache';

@HTTPController()
export class HttpOwnerService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpTransactionService) private readonly HttpTransactionService: HttpTransactionService;
  @inject(HttpMaintainerService) private readonly HttpMaintainerService: HttpMaintainerService;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }

  @HTTPRouter({
    pathname: '/-/user/org.couchdb.user:name',
    methods: 'GET',
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('owner'))
  public async getOwnerInfo(@HTTPRequestParam('name') name: string) {
    name = name.startsWith(':') ? name.substr(1) : name;
    const User = this.connection.getRepository(UserEntity);
    const user = await User.findOne({ account: name });
    if (!user) throw new HttpNotFoundException();
    return {
      account: user.account,
      name: user.nickname,
      email: user.email,
      avatar: user.avatar,
    }
  }

  public updateOwner(body: TOwnerState, user: UserEntity) {
    return this.HttpTransactionService.transaction(async runner => {
      const Packages = runner.manager.getRepository(PackageEntity);
      const Maintainer = runner.manager.getRepository(MaintainerEntity);
      const User = runner.manager.getRepository(UserEntity);
      let pack = await Packages.findOne({ rev: body._rev });
      if (!pack) throw new HttpUnprocessableEntityException('can not find package rev of ' + body._rev);
      if (pack.pathname !== body._id) throw new HttpUnprocessableEntityException('package name is invaild');
      if (pack.uid !== user.id) throw new HttpUnprocessableEntityException('you are not one of maintainers or package admins');

      const users = await User.find({
        where: {
          account: In(body.maintainers.map(maintainer => maintainer.name))
        }
      })

      if (users.length !== body.maintainers.length) throw new HttpUnprocessableEntityException('some user is not exists');

      const maintainers = await Maintainer.find({ pid: pack.id });
      const oldMaintainerIds = maintainers.map(maintainer => maintainer.uid);
      const newMaintainerIds = users.map(user => user.id);
      const { adds, removes } = diff(oldMaintainerIds, newMaintainerIds);

      for (let i = 0 ; i < adds.length; i++) await this.HttpMaintainerService.createNewMaintainer(pack.id, adds[i], Maintainer);
      for (let i = 0 ; i < removes.length; i++) {
        if (removes[i] == user.id) throw new HttpUnprocessableEntityException('you cannot remove youself in package ' + pack.pathname);
        await this.HttpMaintainerService.removeOne(pack.id, removes[i], Maintainer);
      }

      pack.maintainers = newMaintainerIds.length;
      await Packages.save(pack);
      await PackageCacheAble.build({ pkg: pack.pathname }, runner.manager);
      this.npmcore.emit('owner:update', pack, body.maintainers);
      return { ok: true }
    })
  }
}

export interface TOwnerState {
  _id: string,
  _rev: string,
  maintainers: TPackageMaintainerState[],
}