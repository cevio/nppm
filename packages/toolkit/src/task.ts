import { Exception } from "./exception";

type TKey = string;
type TOnmessageCallback = <T>(command: TKey, args: any[]) => T | Promise<T>;

type TaskCallback<T> = (...args: any[]) => T | Promise<T>
export class Task {
  private readonly stacks = new Map<TKey, TaskCallback<any>>();
  private callback: TOnmessageCallback;

  public onMessageWhenNotFound(fn: TOnmessageCallback) {
    this.callback = fn;
    return this;
  }

  public on(command: TKey, fn: TaskCallback<any>) {
    this.stacks.set(command, fn);
    return this;
  }

  public off(command: TKey) {
    if (this.stacks.has(command)) {
      this.stacks.delete(command);
    }
    return this;
  }

  public emit(command: TKey, ...value: any[]) {
    if (this.stacks.has(command)) {
      return Promise.resolve(this.stacks.get(command)(...value));
    }
    if (this.callback) {
      return Promise.resolve(this.callback(command, value));
    }
    return Promise.reject(new Exception(1304, 'unknow command:', command, value));
  }
}