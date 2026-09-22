import session from "express-session";
import type Redis from "ioredis";

interface SerializedSession {
  cookie?: {
    expires?: string | Date | null;
  };
}

export class RedisSessionStore extends session.Store {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "sess:"
  ) {
    super();
  }

  override get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    this.redis.get(this.key(sid))
      .then((value) => callback(null, value ? JSON.parse(value) as session.SessionData : null))
      .catch((error: unknown) => callback(error));
  }

  override set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    const ttl = this.ttl(sess);
    this.redis.set(this.key(sid), JSON.stringify(sess), "EX", ttl)
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.redis.del(this.key(sid))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.redis.expire(this.key(sid), this.ttl(sess))
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  private key(sid: string): string {
    return `${this.prefix}${sid}`;
  }

  private ttl(sess: session.SessionData): number {
    const serialized = sess as unknown as SerializedSession;
    const expires = serialized.cookie?.expires;
    if (expires) {
      const ttlMs = (expires instanceof Date ? expires : new Date(expires)).getTime() - Date.now();
      return Math.max(60, Math.ceil(ttlMs / 1000));
    }
    return 15 * 60;
  }
}
