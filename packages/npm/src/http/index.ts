import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';
import { HttpUserService } from './user';

export {
  HttpSetupService,
  HttpUserService
}

export default [
  HttpSetupService,
  HttpUserService,
] as interfaces.Newable<any>[];