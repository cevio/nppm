import axios, { AxiosResponse } from 'axios';
import { Service, Public } from '@typeservice/radox';
import { ORMContext, RedisContext, ConfigContext, RadoxContext } from '../effects';
import { ConfigCacheAble } from '../cache';
import { resolve } from 'url';
import { Exception } from '@typeservice/exception';
import { TPackagePublishState } from './package.typing';
import { resolve as pathResolve, dirname } from 'path';
import { ensureDirSync, writeFileSync, removeSync } from 'fs-extra';
import { createHash } from 'crypto';

@Service('com.nppm.package.service')
export class PackageService {
  get radox() {
    return RadoxContext.value;
  }

  get connection() {
    return ORMContext.value;
  }

  get redis() {
    return RedisContext.value;
  }

  get configs() {
    return ConfigContext.value;
  }

  @Public()
  public async getRemotePackageInfo(pkg: string) {
    const configs = await ConfigCacheAble.get();
    const res = await configs.registries.reduce<Promise<AxiosResponse<any>>>((prev, registry) => {
      return prev.then((res) => {
        const state = res.data;
        if (state.error) return Promise.reject(new Exception(404));
        return res;
      }).catch((e: Exception) => {
        if (e.code === 404) {
          return axios.get(resolve(registry, pkg)).catch(e => Promise.reject(new Exception(404)));
        }
        return Promise.reject(e);
      })
    }, Promise.reject(new Exception(404)));
    return res.data;
  }

  @Public()
  public async updatePackage(state: TPackagePublishState) {
    const rollbacks: (() => void | Promise<void>)[] = [];
    const runner = this.connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const fileRollbacks = this.saveTgzFile(state._attachments);
      rollbacks.push(...fileRollbacks);
      console.log(state.versions)
      await runner.commitTransaction();
    } catch (e) {
      await runner.rollbackTransaction();
      let i = rollbacks.length;
      while (i--) await Promise.resolve(rollbacks[i]());
      throw e;
    } finally {
      await runner.release();
    }
  }

  /**
   * 数据源SHA1加密
   * @param tarballBuffer {Buffer} 数据源Buffer
   * @returns string
   */
  @Public()
  public createShasumCode(tarballBuffer: Buffer) {
    const shasum = createHash('sha1');
    shasum.update(tarballBuffer);
    return shasum.digest('hex');
  }

  private saveTgzFile(attachments: TPackagePublishState['_attachments']) {
    const rollbacks: (() => void)[] = [];
    for (const key in attachments) {
      const filename = pathResolve(this.configs.dictionary, key);
      const dictionaryname = dirname(filename);
      ensureDirSync(dictionaryname);
      const tarballBuffer = Buffer.from(attachments[key].data, 'base64');
      if (tarballBuffer.length !== attachments[key].length) {
        throw new Exception(425, `size_wrong: Attachment size ${attachments[key].length} not match download size ${tarballBuffer.length}`);
      }
      // 创建 tarball 的 Buffer 流的 shasum 编码
      // const shasum = this.createShasumCode(tarballBuffer);
      // if (pkg.versions[version].dist.shasum !== shasum) {
      //   throw new BadRequestException(`shasum_wrong: Attachment shasum ${shasum} not match download size ${pkg.versions[version].dist.shasum}`);
      // }
      writeFileSync(filename, tarballBuffer);
      rollbacks.push(((filename) => () => removeSync(filename))(filename));
    }
    return rollbacks;
  }
}