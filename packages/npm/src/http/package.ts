import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HTTPController } from '@typeservice/http';

@HTTPController()
export class HttpPackageService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  get redis() {
    return this.npmcore.redis.value;
  }
}