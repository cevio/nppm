export function MapToJSON<T extends string | number, O extends object, R = any>(map: Map<T, O>, replace?: (value: O) => R) {
  const pools: Record<string, O | R> = {};
  for (const [key, value] of map) {
    pools[key + ''] = replace? replace(value) : value;
  }
  return pools;
}