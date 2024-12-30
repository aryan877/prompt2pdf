import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitConfig {
  interval: number; // time window in seconds
  limit: number; // max requests per interval
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const key = `rate-limit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % config.interval);
  const windowEnd = windowStart + config.interval;

  const multi = await redis
    .pipeline()
    .incr(key)
    .expire(key, config.interval)
    .exec();

  const count = multi[0] as number;

  if (count === 1) {
    // First request in window, set expiry
    await redis.expire(key, config.interval);
  }

  return {
    success: count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    reset: windowEnd,
  };
}

export async function rateLimitMiddleware(
  req: Request,
  identifier: string,
  config: RateLimitConfig
) {
  const result = await rateLimit(identifier, config);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Too many requests",
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset * 1000).toISOString(),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": result.limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toString(),
        },
      }
    );
  }

  return null;
}
