import { format } from 'url';
import { container } from './container';
import { RADOX_APPLICATION_CONTEXT } from './radox';
import { AnnotationMetaDataScan, MethodMetaCreator } from '@typeservice/decorator';
import { ServiceNameSpace, PublicNameSpace } from '@typeservice/radox';
import { THTTPRouterMetaState } from '@typeservice/http';

const HTTPABLE_NAMESPACE = Symbol('http:radox');

export function HttpAccept(props: THTTPRouterMetaState) {
  return MethodMetaCreator.define(HTTPABLE_NAMESPACE, props);
}

export async function createHTTPRadoxServer() {
  const radox = RADOX_APPLICATION_CONTEXT.value;
  const classes = Array.from(radox.namespaces.values()).map(service => service.target);
  const pools: string[] = [];
  const pathes: string[] = [];

  const rollback = async () => {
    for (let i = 0; i < pathes.length; i++) {
      await radox.zookeeper.remove(pathes[i]);
    }
  }

  classes.forEach(service => {
    const source = AnnotationMetaDataScan(service, container);
    if (!source.meta.has(ServiceNameSpace)) return;
    const radoxInterfaceName = source.meta.get(ServiceNameSpace);
    Array.from(source.methods.entries()).forEach(([key, value]) => {
      if (!value.meta.has(PublicNameSpace)) return;
      if (!value.meta.has(HTTPABLE_NAMESPACE)) return;
      const props = value.meta.get(HTTPABLE_NAMESPACE) as THTTPRouterMetaState;
      const obj = {
        protocol: "radox",
        slashes: true,
        host: radoxInterfaceName,
        pathname: '/' + key,
        query: props
      }
      const uri = format(obj as any);
      pools.push('/npm/proxy/' + encodeURIComponent(uri));
    })
  })
  
  try {
    for (let i = 0; i < pools.length; i++) {
      await radox.zookeeper.create(pools[i]);
      pathes.push(pools[i]);
    }
  } catch (e) {
    await rollback();
    throw e;
  }

  return rollback;
}
