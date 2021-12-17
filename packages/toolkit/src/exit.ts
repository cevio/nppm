type TListener<T = any> = (signal?: T) => void | Promise<void>;

export function createExitListener(...extraSignals: string[]) {
  let closing = false;
  const listen = (options: {
    resolve?: TListener<string>, 
    reject?: TListener,
    finally?: TListener
  }) => {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'exit'].concat(extraSignals);
    signals.forEach(signal => {
      process.on(signal, () => {
        if (closing) return;
        closing = true;
        Promise.resolve(
          options.resolve
            ? options.resolve(signal)
            : undefined
        ).catch(e => {
          return options.reject 
            ? options.reject(e) 
            : Promise.reject(e)
        }).finally(() => {
          return options.finally 
            ? options.finally() 
            : process.nextTick(() => process.exit(0))
        });
      })
    })
  }
  return [listen, closing as boolean] as const;
}