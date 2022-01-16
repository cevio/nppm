import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';
import { HttpUserService } from './user';
import { HttpPluginService } from './plugin';

export {
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
}

export default [
  HttpSetupService,
  HttpUserService,
  HttpPluginService,
] as interfaces.Newable<any>[];