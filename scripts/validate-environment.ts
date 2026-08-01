import { parseEnvironment } from '../packages/config/src/environment.js';

try {
  const environment = parseEnvironment();
  console.log(`Environment valid for ${environment.NODE_ENV} on port ${environment.PORT}`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown environment validation error';
  console.error(`Environment validation failed: ${message}`);
  process.exitCode = 1;
}
