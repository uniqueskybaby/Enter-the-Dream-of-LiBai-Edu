import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(__dirname, '..');
const isVercel = process.env.VERCEL === '1';

function env(name, fallback) {
  return process.env[name] || fallback;
}

export const eduConfig = {
  host: env('EDU_HOST', '127.0.0.1'),
  port: Number(env('EDU_PORT', '4178')),
  dbPath: process.env.EDU_DB_PATH
    ? path.resolve(appRoot, process.env.EDU_DB_PATH)
    : isVercel
      ? '/tmp/edu-libai.sqlite'
      : path.resolve(appRoot, 'storage/edu-libai.sqlite'),
  staticDir: path.resolve(appRoot, env('EDU_STATIC_DIR', 'dist')),
  publicDir: path.resolve(appRoot, 'public'),
  allowDevCors: env('EDU_ALLOW_DEV_CORS', '1') === '1',
  aiProvider: env('EDU_AI_PROVIDER', 'local'),
  aiBaseUrl: env('EDU_AI_BASE_URL', 'https://api.openai.com/v1'),
  aiApiKey: env('EDU_AI_API_KEY', ''),
  aiModel: env('EDU_AI_MODEL', 'gpt-4.1-mini'),
  aiTimeoutMs: Number(env('EDU_AI_TIMEOUT_MS', '12000')),
  dialogueRateLimitPerMinute: Number(env('EDU_DIALOGUE_RATE_LIMIT_PER_MINUTE', '18')),
  aiDraftRateLimitPerMinute: Number(env('EDU_AI_DRAFT_RATE_LIMIT_PER_MINUTE', '12')),
};
