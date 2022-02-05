import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';
import { HttpUserService } from './user';
import { HttpPluginService } from './plugin';
import { HttpConfigsService } from './configs';
import { HttpDependencyService } from './dependency';
import { HttpKeywordService } from './keyword';
import { HttpMaintainerService } from './maintainer';
import { HttpTagService } from './tag';
import { HttpVersionService } from './version';
import { HttpPackageService } from './package';
import { HttpPackageDownloadService } from './package.download';
import { HttpPackageFetchService } from './package.fetch';
import { HttpPackagePublishService } from './package.publish';
import { HttpPackageUnPublishService } from './package.unpublish';
import { HttpOwnerService } from './owner';
import { HttpDocsService } from './doc';

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
  HttpPackageDownloadService,
  HttpPackagePublishService,
  HttpPackageUnPublishService,
  HttpOwnerService,
  HttpDocsService,
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
  HttpPackageDownloadService,
  HttpPackageFetchService,
  HttpPackagePublishService,
  HttpPackageUnPublishService,
  HttpOwnerService,
  HttpDocsService,
] as interfaces.Newable<any>[];