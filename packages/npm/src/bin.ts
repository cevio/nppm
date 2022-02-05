#!/usr/bin/env node
import { createServer } from '.';
import { logger } from '@nppm/utils';

createServer((host, schema) => logger.warn(`[PRODUCTION] NPPM registry server start on http://${host}:${schema.port}`));