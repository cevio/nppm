import { inject } from 'inversify';
import { PackageService } from '../service';
import { TPackagePublishState } from '../service';
import { HTTPController, HTTPRouter, HTTPRequestBody, HTTPRequestParam } from '@typeservice/http';

@HTTPController()
export class HttpPackageService {
  @inject(PackageService) private readonly PackageService: PackageService;

  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'GET'
  })
  public getSinglePackageInfomation(@HTTPRequestParam('pkg') pkg: string) {
    return this.PackageService.getRemotePackageInfo(pkg);
  }

  @HTTPRouter({
    pathname: '/:pkg',
    methods: 'PUT'
  })
  public updatePackage(@HTTPRequestBody() body: TPackagePublishState) {
    return this.PackageService.updatePackage(body);
  }
}