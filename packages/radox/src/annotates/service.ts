import { ClassMetaCreator } from './classMetaCreator';
import { injectable } from 'inversify';
export const ServiceNameSpace = Symbol('Service');
export function Service(namespace: string) {
  if (!namespace) throw new Error('@Service arguments must be a string')
  return ClassMetaCreator.join(
    ClassMetaCreator.define(ServiceNameSpace, namespace),
    injectable() as ClassDecorator
  );
}