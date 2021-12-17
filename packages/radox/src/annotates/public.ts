import { MethodMetaCreator } from './methodMetaCreator';
export const PublicNameSpace = Symbol('Public');
export function Public() {
  return MethodMetaCreator.define(PublicNameSpace, true);
}