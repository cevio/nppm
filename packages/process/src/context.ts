export function createContext<T>(defaultValue?: T) {
  const ref = {
    value: defaultValue,
    setContext: (value: T) => {
      ref.value = value;
    }
  }
  return ref;
}