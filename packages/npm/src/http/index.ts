import { interfaces } from 'inversify';
import { HttpSetupService } from './setup';

export {
  HttpSetupService
}

export default [
  HttpSetupService
] as interfaces.Newable<any>[];