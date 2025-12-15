import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// import { upstashCache } from "drizzle-orm/cache/upstash";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle({
  client: pool,
  // cache: upstashCache({
  //   // 👇 Redis credentials (optional — can also be pulled from env vars)
  //   url: "<UPSTASH_URL>",
  //   token: "<UPSTASH_TOKEN>",
  //   // 👇 Enable caching for all queries by default (optional)
  //   global: true,
  //   // 👇 Default cache behavior (optional)
  //   config: { ex: 60 },
  // }),
});
