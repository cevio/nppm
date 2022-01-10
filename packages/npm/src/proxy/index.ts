import { interfaces } from 'inversify';
import { HttpLoginService } from './LoginService';
import { HttpLoginExtraService } from './LoginExtraService';
import { HttpPackageService } from './PackageService';

export {
  HttpLoginService,
  HttpLoginExtraService,
  HttpPackageService,
}

export const HttpProxyServices = [
  HttpLoginService,
  HttpLoginExtraService,
  HttpPackageService,
] as interfaces.Newable<any>[];