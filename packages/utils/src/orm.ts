import { createConnection, ConnectionOptions, Connection } from 'typeorm';
import { isProduction } from './env';
import { createContext } from '@typeservice/process';
import { ref, effect, stop } from '@vue/reactivity';
import { logger } from './logger';

type TCreateORMServerEntity = ConnectionOptions['entities'];

export const ORM_CONNECTION_CONTEXT = createContext<Connection>();

export interface TORMConfigs {
  readonly type: string,
  readonly host: string,
  readonly port: number,
  readonly username: string,
  readonly password: string,
  readonly database: string,
}

export interface TCreateORMServerProps {
  synchronize?: boolean,
  entities: TCreateORMServerEntity,
  configs: TORMConfigs,
}

export function createORMServer(props: TCreateORMServerProps) {
  return async () => {
    const configs = Object.assign(props.configs, {
      synchronize: !!props.synchronize,
      logging: !isProduction,
      entities: props.entities,
    }) as ConnectionOptions;
    const connection = await createConnection(configs);
    ORM_CONNECTION_CONTEXT.setContext(connection);
    return () => connection.close();
  }
}

export const ORM_TYPE = ref<TORMConfigs['type']>();
export const ORM_HOST = ref<TORMConfigs['host']>();
export const ORM_PORT = ref<TORMConfigs['port']>();
export const ORM_USERNAME = ref<TORMConfigs['username']>();
export const ORM_PASSWORD = ref<TORMConfigs['password']>();
export const ORM_DATABASE = ref<TORMConfigs['database']>();

export function createORMObserver(props: TCreateORMServerProps) {
  const doing = createContext(false);
  setORMState(props.configs);
  return () => {
    const stopEffect = effect(() => {
      if (ORM_TYPE.value && ORM_HOST.value && ORM_PORT.value && ORM_USERNAME.value && ORM_PASSWORD.value && ORM_DATABASE.value) {
        if (!doing.value) {
          doing.setContext(true);
          process.nextTick(() => createORMAsyncServer(props, () => doing.setContext(false)));
        }
      }
    })
    return async () => {
      stop(stopEffect);
      if (ORM_CONNECTION_CONTEXT.value) {
        await ORM_CONNECTION_CONTEXT.value.close();
      }
    }
  }
}

export function setORMState(state: TORMConfigs) {
  ORM_TYPE.value = state.type;
  ORM_HOST.value = state.host;
  ORM_PORT.value = state.port;
  ORM_USERNAME.value = state.username;
  ORM_PASSWORD.value = state.password;
  ORM_DATABASE.value = state.database;
}

export function createORMAsyncServer(props: TCreateORMServerProps, done: () => void) {
  if (ORM_CONNECTION_CONTEXT.value) {
    ORM_CONNECTION_CONTEXT.value.close();
    ORM_CONNECTION_CONTEXT.setContext(null);
  }
  createConnection({
    type: ORM_TYPE.value,
    host: ORM_HOST.value,
    port: ORM_PORT.value,
    username: ORM_USERNAME.value,
    password: ORM_PASSWORD.value,
    database: ORM_DATABASE.value,
    synchronize: !!props.synchronize,
    logging: !isProduction,
    entities: props.entities,
  } as ConnectionOptions).then(connection => {
    ORM_CONNECTION_CONTEXT.setContext(connection);
  }).catch(e => logger.error(e)).finally(done);
}