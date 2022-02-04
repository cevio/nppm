import { HTTPController, HTTPRouter, HTTPRequestParam, HTTPRequestQuery } from '@typeservice/http';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { HttpNotFoundException } from '@typeservice/exception';

@HTTPController()
export class HttpDocsService {
  @HTTPRouter({
    pathname: '/~/docs',
    methods: 'GET'
  })
  public getDocs(@HTTPRequestQuery('entry') entry?: string) {
    const dir = resolve(__dirname, '../../docs');
    const isEntry = entry === 'true';
    if (!existsSync(dir)) throw new HttpNotFoundException('cannot find any docs')
    const files = readdirSync(dir);
    return files.map(file => {
      const left = file.split('.')[0];
      const sp = left.split(':');
      return {
        value: sp[0],
        label: sp[1],
        file: isEntry ? resolve(dir, file) : undefined,
      }
    });
  }

  @HTTPRouter({
    pathname: '/~/docs/:name',
    methods: 'GET'
  })
  public getDoc(@HTTPRequestParam('name') name: string) {
    const files = this.getDocs('true');
    const file = files.find(file => file.value === name);
    if (!file) throw new HttpNotFoundException('cannot find the doc name of ' + name);
    return readFileSync(file.file, 'utf8');
  }
}