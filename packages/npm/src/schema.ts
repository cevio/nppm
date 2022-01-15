import { TSchema } from "./interface";
import { HttpServiceUnavailableException } from '@typeservice/exception';

export function createSchemaServer(schema: TSchema) {
  if (!schema.port) {
    throw new HttpServiceUnavailableException('NPM server need `port` option, you must be use `--port <port>` on commander line');
  }
}