import { TLoginResult } from '@nppm/core';
export const stacks = new Map<string, { status: number, data: TLoginResult, msg: string, timer: NodeJS.Timer }>();