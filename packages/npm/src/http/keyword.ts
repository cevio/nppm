import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { Repository } from 'typeorm';
import { HTTPController } from '@typeservice/http';
import { KeywordEntity } from '@nppm/entity';

@HTTPController()
export class HttpKeywordService {
  @inject('npmcore') private readonly npmcore: NPMCore;

  get connection() {
    return this.npmcore.orm.value;
  }

  public async createNewVersionKeywords(vid: number, pid: number, keywords: string[] = [], Keyword?: Repository<KeywordEntity>) {
    Keyword = Keyword || this.connection.getRepository(KeywordEntity);
    for (let i = 0; i < keywords.length; i++) {
      const keyword = new KeywordEntity();
      keyword.gmt_create = new Date();
      keyword.gmt_modified = new Date();
      keyword.name = keywords[i];
      keyword.vid = vid;
      keyword.pid = pid;
      await Keyword.save(keyword);
    }
  }

  public removeKeywordByVid(vid: number, Keyword?: Repository<KeywordEntity>) {
    Keyword = Keyword || this.connection.getRepository(KeywordEntity);
    return Keyword.delete({ vid });
  }

  public removeAll(pid: number, Keyword?: Repository<KeywordEntity>) {
    Keyword = Keyword || this.connection.getRepository(KeywordEntity);
    return Keyword.delete({ pid });
  }
}