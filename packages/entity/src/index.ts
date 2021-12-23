import { createConnection, ConnectionOptions, Connection } from 'typeorm';

import { ConfigEntity } from './ConfigEntity';
import { UserEntity } from './UserEntity';
import { PackageEntity } from './PackageEntity';

export {
  ConfigEntity,
  UserEntity,
  PackageEntity,
}

export interface TORMConfigs {
  type: string,
  host: string,
  port: number,
  username: string,
  password: string,
  database: string,
}

export function createORMServer(options: TORMConfigs, synchronize?: boolean) {
  const configs = Object.assign({}, options, {
    synchronize: !!synchronize,
    logging: true,
    entities: [
      ConfigEntity,
      UserEntity,
    ],
  }) as ConnectionOptions;
  return createConnection(configs);
}

export function closeORMServer(connection: Connection) {
  return connection.close();
}