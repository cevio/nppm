import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HTTPController } from '@typeservice/http';
import { Repository } from 'typeorm';
import { MaintainerEntity } from '@nppm/entity';

@HTTPController()
export class HttpMaintainerService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async createNewMaintainer(pid: number, uid: number, Maintainer?: Repository<MaintainerEntity>) {
    Maintainer = Maintainer || this.connection.getRepository(MaintainerEntity);
    let count = await Maintainer.count({ pid, uid });
    if (!count) {
      const maintainer = new MaintainerEntity();
      maintainer.gmt_create = new Date();
      maintainer.gmt_modified = new Date();
      maintainer.pid = pid;
      maintainer.uid = uid;
      await Maintainer.save(maintainer);
    }
  }

  public getCountByPackage(pid: number, Maintainer?: Repository<MaintainerEntity>) {
    Maintainer = Maintainer || this.connection.getRepository(MaintainerEntity);
    return Maintainer.count({ pid });
  }

  public getMaintainersByPackage(pid: number, Maintainer?: Repository<MaintainerEntity>) {
    Maintainer = Maintainer || this.connection.getRepository(MaintainerEntity);
    return Maintainer.find({ pid });
  }

  public removeAll(pid: number, Maintainer?: Repository<MaintainerEntity>) {
    Maintainer = Maintainer || this.connection.getRepository(MaintainerEntity);
    return Maintainer.delete({ pid });
  }

  public async removeOne(pid: number, uid: number, Maintainer?: Repository<MaintainerEntity>) {
    Maintainer = Maintainer || this.connection.getRepository(MaintainerEntity);
    const maintainer = await Maintainer.findOne({ pid, uid });
    await Maintainer.delete(maintainer.id);
  }
}

export interface TPackageMaintainerState {
  name: string,
  email: string,
}