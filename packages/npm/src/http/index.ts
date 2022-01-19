import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';
import { HttpUserService } from './user';
import { HttpPluginService } from './plugin';
import { HttpConfigsService } from './configs';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpPackageService } from './package';
import { HttpTagService } from './tag';
import { HttpVersionService } from './version';

export {
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
  HttpConfigsService,
  HttpDependencyService,
  HttpKeywordService,
  HttpMaintainerService,
  HttpPackageService,
  HttpTagService,
  HttpVersionService,
}

export default [
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
  HttpConfigsService,
  HttpDependencyService,
  HttpKeywordService,
  HttpMaintainerService,
  HttpPackageService,
  HttpTagService,
  HttpVersionService,
] as interfaces.Newable<any>[];