import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';
import { HttpUserService } from './user';
import { HttpPluginService } from './plugin';
import { HttpConfigsService } from './configs';

export {
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
  HttpConfigsService,
}

export default [
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
  HttpConfigsService,
] as interfaces.Newable<any>[];