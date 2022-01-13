import { TSchema } from "./interface";
import { HttpServiceUnavailableException } from '@typeservice/exception';

export function createSchemaServer(schema: TSchema) {
  if (!schema.port || !schema.zookeeper) {
    throw new HttpServiceUnavailableException('缺少参数 port 或者 zookeeper');
  }
}