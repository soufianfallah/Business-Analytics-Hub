import "server-only";

import { createClient, type RedisClientType } from "redis";
import { getServerEnv } from "@/lib/env";

type Entry = { value: string; expiresAt: number };
const memory = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_MEMORY_ENTRIES = 500;
const globalCache = globalThis as unknown as {
  redis?: RedisClientType;
  redisConnecting?: Promise<RedisClientType | null>;
};

async function redisClient() {
  const url = getServerEnv().REDIS_URL;
  if (!url) return null;
  if (globalCache.redis?.isReady) return globalCache.redis;
  if (!globalCache.redisConnecting)
    globalCache.redisConnecting = (async () => {
      try {
        const client = createClient({
          url,
          socket: { connectTimeout: 1_000, reconnectStrategy: false },
        });
        client.on("error", (error) =>
          console.warn("[cache.redis] unavailable", { message: error.message }),
        );
        await client.connect();
        globalCache.redis = client as RedisClientType;
        return globalCache.redis;
      } catch {
        return null;
      }
    })();
  return globalCache.redisConnecting;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await redisClient();
  if (redis) {
    try {
      const value = await redis.get(namespaced(key));
      if (value) return JSON.parse(value) as T;
    } catch (error) {
      console.warn("[cache.redis] read failed", {
        key,
        message: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
  const local = memory.get(key);
  if (!local) return null;
  if (local.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  memory.delete(key);
  memory.set(key, local);
  return JSON.parse(local.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
) {
  if (ttlSeconds <= 0) return;
  const serialized = JSON.stringify(value);
  const redis = await redisClient();
  if (redis) {
    try {
      await redis.set(namespaced(key), serialized, { EX: ttlSeconds });
      return;
    } catch (error) {
      console.warn("[cache.redis] write failed", {
        key,
        message: error instanceof Error ? error.message : "Unknown",
      });
    }
  }
  memory.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1_000,
  });
  while (memory.size > MAX_MEMORY_ENTRIES)
    memory.delete(memory.keys().next().value!);
}

export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = loader()
    .then(async (value) => {
      await cacheSet(key, value, ttlSeconds);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
export async function cacheHealth() {
  const redis = await redisClient();
  if (!redis) return { layer: "memory" as const, healthy: true };
  try {
    await redis.ping();
    return { layer: "redis" as const, healthy: true };
  } catch {
    return { layer: "memory" as const, healthy: true };
  }
}
const namespaced = (key: string) => `bah:v1:${key}`;
