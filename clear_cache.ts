import Redis from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
});

async function main() {
  console.log('Clearing SUBSCRIPTION_PLANS cache...');
  await redis.del('SUBSCRIPTION_PLANS');
  console.log('Done.');
  process.exit(0);
}

main().catch(console.error);
