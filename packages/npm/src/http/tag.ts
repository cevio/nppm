import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HTTPController } from '@typeservice/http';
import { Repository } from 'typeorm';
import { TagEntity } from '@nppm/entity';
import { HttpUnprocessableEntityException } from '@typeservice/exception';

@HTTPController()
export class HttpTagService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async createNewDistTag(pid: number, vid: number, name: string, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    let tag = await Tag.findOne({ namespace: name, pid });
    if (!tag) {
      tag = new TagEntity();
      tag.gmt_create = new Date();
      tag.namespace = name || 'latest';
      tag.pid = pid;
    }
    tag.vid = vid;
    tag.gmt_modified = new Date();
    await Tag.save(tag);
  }

  public async getLatestVersion(pid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const tag = await Tag.findOne({ namespace: 'latest', pid });
    if (tag) return tag.vid;
  }

  public async removeTagByVid(pid: number, vid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    const tag = await Tag.findOne({ vid, pid });
    if (tag) {
      if (tag.namespace === 'latest') throw new HttpUnprocessableEntityException('cannot delete tag by name of latest');
      await Tag.delete(tag.id);
    }
  }

  public removeAll(pid: number, Tag?: Repository<TagEntity>) {
    Tag = Tag || this.connection.getRepository(TagEntity);
    return Tag.delete({ pid });
  }
}