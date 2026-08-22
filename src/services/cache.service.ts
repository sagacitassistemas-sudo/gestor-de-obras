import NodeCache from 'node-cache';

// Inicializa o cache com TTL padrão de 4 horas (14400 segundos)
// maxKeys previne OOM attack (limitado a 5000 chaves)
export const systemCache = new NodeCache({
  stdTTL: 14400,
  checkperiod: 600,
  maxKeys: 5000
});

/**
 * Helper genérico para buscar ou hidratar um cache.
 */
export async function getOrSetCache<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
  const cachedValue = systemCache.get<T>(key);
  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const freshData = await fetchFn();
  
  if (ttlSeconds) {
    systemCache.set(key, freshData, ttlSeconds);
  } else {
    systemCache.set(key, freshData);
  }

  return freshData;
}

export function invalidateCache(keyPrefix: string) {
  const keys = systemCache.keys();
  const keysToDelete = keys.filter(k => k.startsWith(keyPrefix));
  if (keysToDelete.length > 0) {
    systemCache.del(keysToDelete);
  }
}
