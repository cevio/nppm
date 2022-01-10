import { interfaces } from 'inversify';
import { HttpService } from './http';
import { UserService } from './user';
import { PackageService } from './package';
export * from './package.typing';

export {
  HttpService,
  UserService,
  PackageService,
}

export const Services = [
  HttpService,
  UserService,
  PackageService,
] as interfaces.Newable<any>[];