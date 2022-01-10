import { Service, Public } from '@typeservice/radox';
import { ConfigContext, ApplicationContext, RadoxContext } from '../effects';
import { HTTPMethod } from 'find-my-way';
import { Exception } from '@typeservice/exception';

interface THttpRouterRegister {
  HttpMethod: HTTPMethod,
  HttpRouter: string,
  RPCNamespace: string,
  RPCMethod: string,
}

interface TLoginState {
  command: string,
  method: string,
}

@Service('com.nppm.http.service')
export class HttpService {
  private readonly routes = new Map<string, { off: () => void, idents: Set<string> }>();
  public readonly logins = new Map<string, { auth: TLoginState, check: TLoginState }>();

  get radox() {
    return RadoxContext.value;
  }

  get route() {
    return ApplicationContext.value;
  }

  static encodeHttpRouteId(HttpMethod: HTTPMethod, HttpRouter: string) {
    return `${HttpMethod}:${HttpRouter}`;
  }

  @Public()
  public registerHTTPRoutes(id: string, routes: THttpRouterRegister[]) {
    routes.forEach(state => {
      const encodeID = HttpService.encodeHttpRouteId(state.HttpMethod, state.HttpRouter);
      if (!this.routes.has(encodeID)) {
        this.route.addController(state.HttpMethod, state.HttpRouter, async ctx => {
          const res = await this.radox.sendback({
            command: state.RPCNamespace,
            method: state.RPCMethod,
            arguments: [{
              query: ctx.query,
              params: ctx.params,
              body: ctx.request.body,
              headers: ctx.headers,
            }]
          })
          ctx.body = res;
        })
        this.routes.set(encodeID, {
          off: () => this.route.removeController(state.HttpMethod, state.HttpRouter),
          idents: new Set(),
        });
      }
      this.routes.get(encodeID).idents.add(id);
    })
    return Date.now();
  }

  @Public()
  public unRegisterHTTPRoutes(id: string) {
    for (const [key, { off, idents }] of this.routes) {
      if (idents.has(id)) {
        idents.delete(id);
        if (idents.size === 0) {
          this.routes.delete(key);
          off();
        }
        break;
      }
    }
    return Date.now();
  }

  @Public()
  public getServerConfigs() {
    return ConfigContext.value;
  }

  @Public()
  public registerLoginPlugin(id: string, options: { auth: TLoginState, check: TLoginState }) {
    if (this.logins.has(id)) throw new Exception(5000, `id:${id} has already exists`);
    this.logins.set(id, options);
    return Date.now();
  }

  @Public()
  public unRegisterLoginPlugin(id: string) {
    if (this.logins.has(id)) {
      this.logins.delete(id);
    }
    return Date.now();
  }
}