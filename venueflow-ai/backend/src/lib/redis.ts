import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isConnected = false;

// In-memory fallback when Redis is unavailable
const memoryStore: Map<string, { value: string; expiresAt: number | null }> = new Map();

function getMemoryValue(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function setMemoryValue(key: string, value: string, ttlSeconds?: number): void {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

export function initRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not set — using in-memory fallback');
    return null;
  }

  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Redis] Max retries reached — switching to in-memory fallback');
          return null;
        }
        return Math.min(times * 500, 2000);
      },
    });

    client.on('connect', () => {
      console.log('[Redis] Connected ✓');
      isConnected = true;
    });

    client.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      isConnected = false;
    });

    redisClient = client;
    return client;
  } catch (err) {
    console.warn('[Redis] Failed to initialize — using in-memory fallback');
    return null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  if (isConnected && redisClient) {
    try {
      return await redisClient.get(key);
    } catch {
      return getMemoryValue(key);
    }
  }
  return getMemoryValue(key);
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (isConnected && redisClient) {
    try {
      if (ttlSeconds) {
        await redisClient.setex(key, ttlSeconds, value);
      } else {
        await redisClient.set(key, value);
      }
      return;
    } catch {
      // fallthrough to memory
    }
  }
  setMemoryValue(key, value, ttlSeconds);
}

export async function redisExists(key: string): Promise<boolean> {
  if (isConnected && redisClient) {
    try {
      const result = await redisClient.exists(key);
      return result > 0;
    } catch {
      return getMemoryValue(key) !== null;
    }
  }
  return getMemoryValue(key) !== null;
}

export async function redisDel(key: string): Promise<void> {
  if (isConnected && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch {
      // fallthrough
    }
  }
  memoryStore.delete(key);
}

export async function redisKeys(pattern: string): Promise<string[]> {
  if (isConnected && redisClient) {
    try {
      return await redisClient.keys(pattern);
    } catch {
      // fallthrough
    }
  }
  // Simple pattern matching for in-memory
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return Array.from(memoryStore.keys()).filter(k => regex.test(k));
}

export { redisClient };
