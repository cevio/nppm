import { Context, Next } from 'koa';
import { resolve, join, normalize, sep, parse, basename, extname } from 'path';
import { ServerResponse } from 'http';
import { Stats, existsSync, statSync, createReadStream } from 'fs';
import { HttpNotFoundException, HttpBadRequestException, HttpPaymentRequiredException, HttpForbiddenException } from '@typeservice/exception';
import * as pathIsAbsolute from 'path-is-absolute';

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

export interface TStaticSendOptions {
  root?: string,
  index?: string,
  maxage?: number,
  maxAge?: number,
  immutable?: boolean,
  hidden?: boolean,
  format?: boolean,
  extensions?: string[],
  brotli?: boolean,
  gzip?: boolean,
  fallback?: boolean,
  setHeaders?: (res: ServerResponse, key: string, value: Stats) => void,
}

export async function StaticMiddleware(ctx: Context, next: Next) {
  if (ctx.path === '/') return await next();
  if (ctx.method !== 'GET') return await next();
  if (ctx.url.startsWith('/~')) return await next();
  if (ctx.url.startsWith('/-')) return await next();
  const useragent = ctx.header['user-agent'];
  if (/npm\/\d+\.\d+\.\d+/.test(useragent)) return await next();
  send(ctx, ctx.path, {
    root: resolve(__dirname, '../../theme'),
    index: 'index.html',
    maxAge: 2 * 60 * 60 * 1000,
    gzip: true,
    fallback: true,
  });
}

async function send(ctx: Context, path: string, opts: TStaticSendOptions = {}) {
  const root = opts.root ? normalize(resolve(opts.root)) : '';
  const trailingSlash = path[path.length - 1] === '/';
  path = path.substr(parse(path).root.length);
  const index = opts.index;
  const maxage = opts.maxage || opts.maxAge || 0;
  const immutable = opts.immutable || false;
  const hidden = opts.hidden || false;
  const format = opts.format !== false;
  const extensions = Array.isArray(opts.extensions) ? opts.extensions : false;
  const brotli = opts.brotli !== false;
  const gzip = opts.gzip !== false;
  const setHeaders = opts.setHeaders;
  const fallback = opts.fallback;

  if (setHeaders && typeof setHeaders !== 'function') {
    throw new TypeError('option setHeaders must be function')
  }

  // normalize path
  path = decode(path);

  if (!path) throw new HttpBadRequestException();

  // index file support
  if (index && trailingSlash) path += index;

  path = resolvePath(root, path);

  // hidden file support, ignore
  if (!hidden && isHidden(root, path)) return;

  let encodingExt = '';
  // serve brotli file when possible otherwise gzipped file when possible
  if (ctx.acceptsEncodings('br', 'identity') === 'br' && brotli && existsSync(path + '.br')) {
    path = path + '.br';
    ctx.set('Content-Encoding', 'br');
    ctx.res.removeHeader('Content-Length');
    encodingExt = '.br';
  } else if (ctx.acceptsEncodings('gzip', 'identity') === 'gzip' && gzip && existsSync(path + '.gz')) {
    path = path + '.gz';
    ctx.set('Content-Encoding', 'gzip');
    ctx.res.removeHeader('Content-Length');
    encodingExt = '.gz';
  }
  if (extensions && !/\./.exec(basename(path))) {
    const list = [].concat(extensions);
    for (let i = 0; i < list.length; i++) {
      let ext = list[i];
      if (typeof ext !== 'string') {
        throw new TypeError('option extensions must be array of strings or false');
      }
      if (!/^\./.exec(ext)) ext = `.${ext}`;
      if (existsSync(`${path}${ext}`)) {
        path = `${path}${ext}`;
        break;
      }
    }
  }

  // stat
  let stats: Stats;
  try {
    stats = statSync(path);

    // Format the path to serve static file servers
    // and not require a trailing slash for directories,
    // so that you can do both `/directory` and `/directory/`
    if (stats.isDirectory()) {
      if (format && index) {
        path += `/${index}`
        stats = statSync(path)
      } else {
        return
      }
    }
  } catch (err) {
    const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];
    if (notfound.includes(err.code) && fallback) {
      path = resolve(opts.root, opts.index);
      if (!existsSync(path)) throw new HttpNotFoundException(err.message);
      stats = statSync(path);
    }
    if (!stats) {
      throw new HttpNotFoundException(err.message);
    }
  }

  if (setHeaders) setHeaders(ctx.res, path, stats);

  // stream
  ctx.set('Content-Length', stats.size + '');
  if (!ctx.response.get('Last-Modified')) ctx.set('Last-Modified', stats.mtime.toUTCString())
  if (!ctx.response.get('Cache-Control')) {
    const directives = [`max-age=${(maxage / 1000 | 0)}`]
    if (immutable) {
      directives.push('immutable')
    }
    ctx.set('Cache-Control', directives.join(','))
  }
  if (!ctx.type) ctx.type = type(path, encodingExt)
  ctx.body = createReadStream(path)

  return path;
}

function resolvePath(rootPath: string, relativePath?: string): string {
  let path = relativePath;
  let root = rootPath;
  // root is optional, similar to root.resolve
  if (!relativePath) {
    path = rootPath;
    root = process.cwd();
  }

  if (root == null) {
    throw new HttpPaymentRequiredException('argument rootPath is required');
  }

  if (typeof root !== 'string') {
    throw new HttpPaymentRequiredException('argument rootPath must be a string');
  }

  if (path == null) {
    throw new HttpPaymentRequiredException('argument relativePath is required');
  }

  if (typeof path !== 'string') {
    throw new HttpPaymentRequiredException('argument relativePath must be a string');
  }

  // containing NULL bytes is malicious
  if (path.indexOf('\0') !== -1) {
    throw new HttpBadRequestException('Malicious Path');
  }

  // path should never be absolute
  if (pathIsAbsolute.posix(path) || pathIsAbsolute.win32(path)) {
    throw new HttpBadRequestException('Malicious Path');
  }
  
  // path outside root
  if (UP_PATH_REGEXP.test(normalize('.' + sep + path))) {
    throw new HttpForbiddenException()
  }

  // join the relative path
  return normalize(join(resolve(root), path))
}

/**
 * Check if it's hidden.
 */

 function isHidden (root: string, path: string) {
  const _path = path.substr(root.length).split(sep);
  for (let i = 0; i < _path.length; i++) {
    if (_path[i][0] === '.') return true;
  }
  return false
}

/**
 * Decode `path`.
 */

function decode (path: string) {
  try {
    return decodeURIComponent(path);
  } catch (err) {}
}

/**
 * File type.
 */

function type (file: string, ext: string) {
  return ext !== '' ? extname(basename(file, ext)) : extname(file)
}