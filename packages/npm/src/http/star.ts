import { inject } from 'inversify';
import { NPMCore } from '@nppm/core';
import { HttpPackagePublishService } from './package.publish';
import { HTTPController, HTTPRouter, HTTPRouterMiddleware, HTTPRequestState, HTTPRequestParam, HTTPRequestBody } from '@typeservice/http';
import { PackageEntity, StarEntity, UserEntity } from '@nppm/entity';
import { 
  createNPMErrorCatchMiddleware, 
  NpmCommanderLimit, 
  OnlyRunInCommanderLineInterface, 
  UserInfoMiddleware, 
  UserMustBeLoginedMiddleware, 
  UserNotForbiddenMiddleware 
} from '@nppm/utils';

@HTTPController()
export class HttpStarService {
  @inject('npmcore') private readonly npmcore: NPMCore;
  @inject(HttpPackagePublishService) private readonly HttpPackagePublishService: HttpPackagePublishService;

  get connection() {
    return this.npmcore.orm.value;
  }

  @HTTPRouter({
    pathname: '/-/_view/starredByUser',
    methods: 'GET'
  })
  @HTTPRouterMiddleware(createNPMErrorCatchMiddleware)
  @HTTPRouterMiddleware(OnlyRunInCommanderLineInterface)
  @HTTPRouterMiddleware(NpmCommanderLimit('stars'))
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public async getStars(@HTTPRequestState('user') user: UserEntity) {
    const Star = this.connection.getRepository(StarEntity);
    const rows = await Star.createQueryBuilder('star')
      .leftJoin(PackageEntity, 'pack', 'pack.id=star.pid')
      .select('pack.pathname', 'value')
      .where({ uid: user.id })
      .getRawMany();

    return { rows }
  }

  @HTTPRouter({
    pathname: '/~/star/:pkg',
    methods: 'PUT'
  })
  @HTTPRouterMiddleware(UserInfoMiddleware)
  @HTTPRouterMiddleware(UserMustBeLoginedMiddleware)
  @HTTPRouterMiddleware(UserNotForbiddenMiddleware)
  public star(
    @HTTPRequestParam('pkg') pkg: string, 
    @HTTPRequestBody() body: { status: boolean },
    @HTTPRequestState('user') user: UserEntity
  ) {
    return body.status 
      ? this.HttpPackagePublishService.star({ _id: pkg }, user)
      : this.HttpPackagePublishService.unstar({ _id: pkg }, user);
  }
}