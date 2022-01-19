import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HTTPController } from '@typeservice/http';
import { Repository } from 'typeorm';
import { TagEntity } from '@nppm/entity';

@HTTPController()
export class HttpTagService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async createNewDistTag(pid: number, vid: number, name: string, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const count = await Tag.count({ namespace: name, pid });
    if (!count) {
      const tag = new TagEntity();
      tag.gmt_create = new Date();
      tag.gmt_modified = new Date();
      tag.namespace = name;
      tag.pid = pid;
      tag.vid = vid;
      await Tag.save(tag);
    }
  }

  public async getLatestVersion(pid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const tag = await Tag.findOne({ namespace: 'latest', pid });
    if (tag) return tag.vid;
  }
}