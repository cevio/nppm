import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HTTPController } from '@typeservice/http';
import { Repository } from 'typeorm';
import { TPackageVersionState } from './version';
import { DependencyEntity } from '@nppm/entity';

@HTTPController()
export class HttpDependencyService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async createNewVersionDependencies(
    vid: number, 
    pid: number,
    dependencies: TPackageVersionState['dependencies'] = {},
    Dependency?: Repository<DependencyEntity>
  ) {
    Dependency = Dependency || this.connection.getRepository(DependencyEntity);
    for (const key in dependencies) {
      const value = dependencies[key];
      const dependency = new DependencyEntity();
      dependency.gmt_create = new Date();
      dependency.gmt_modified = new Date();
      dependency.pathname = key;
      dependency.value = value;
      dependency.vid = vid;
      dependency.pid = pid;
      await Dependency.save(dependency);
    }
  }

  public removeDenpenencyByVid(vid: number, Dependency?: Repository<DependencyEntity>) {
    Dependency = Dependency || this.connection.getRepository(DependencyEntity);
    return Dependency.delete({ vid });
  }

  public removeAll(pid: number, Dependency?: Repository<DependencyEntity>) {
    Dependency = Dependency || this.connection.getRepository(DependencyEntity);
    return Dependency.delete({ pid });
  }
}