import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const composeFile = path.join(repositoryRoot, 'compose.test.yaml');
const projectName = `eventory-integration-${process.pid}-${Date.now()}`;
const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
const pnpmPrefix = isWindows ? ['/d', '/s', '/c', 'pnpm.cmd'] : [];

function composeArgs(...args) {
  return ['compose', '--project-name', projectName, '--file', composeFile, ...args];
}

function run(command, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function runChecked(command, args, environment, description) {
  const result = await run(command, args, environment);
  if (result.code !== 0) {
    throw new Error(`${description} failed with exit code ${result.code}`);
  }
  return result;
}

async function mappedPort(service, containerPort) {
  const result = await runChecked(
    'docker',
    composeArgs('port', service, String(containerPort)),
    process.env,
    `Reading ${service} port`,
  );
  const line = result.stdout.trim().split(/\r?\n/).at(-1) ?? '';
  const port = Number(line.slice(line.lastIndexOf(':') + 1));
  if (!Number.isInteger(port) || port < 1) {
    throw new Error(`Could not read a dynamic port for ${service}: ${line}`);
  }
  return port;
}

async function assertSentinels() {
  const database = await runChecked(
    'docker',
    composeArgs(
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'eventory',
      '-d',
      'eventory_test',
      '-tAc',
      'SELECT current_database()',
    ),
    process.env,
    'PostgreSQL test-database sentinel',
  );
  if (database.stdout.trim() !== 'eventory_test') {
    throw new Error(
      `Integration tests require eventory_test, got ${JSON.stringify(database.stdout.trim())}`,
    );
  }

  const redis = await runChecked(
    'docker',
    composeArgs('exec', '-T', 'redis', 'redis-cli', 'ping'),
    process.env,
    'Redis sentinel',
  );
  if (redis.stdout.trim() !== 'PONG') throw new Error('Redis sentinel did not return PONG');

  await runChecked(
    'docker',
    composeArgs('exec', '-T', 'mailpit', 'wget', '-q', '--spider', 'http://127.0.0.1:8025/'),
    process.env,
    'Mailpit sentinel',
  );
}

let cleanupRequired = false;
try {
  // Compose can create a subset of the project before reporting a startup
  // failure. Always attempt cleanup for this unique project name.
  cleanupRequired = true;
  await runChecked(
    'docker',
    composeArgs('up', '--detach', '--wait'),
    process.env,
    'Starting dependencies-only Compose target',
  );

  const postgresPort = await mappedPort('postgres', 5432);
  const redisPort = await mappedPort('redis', 6379);
  const mailpitPort = await mappedPort('mailpit', 1025);
  await assertSentinels();

  const testEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: `postgresql://eventory:eventory@127.0.0.1:${postgresPort}/eventory_test?schema=public`,
    REDIS_URL: `redis://127.0.0.1:${redisPort}`,
    MAILPIT_HOST: '127.0.0.1',
    MAILPIT_PORT: String(mailpitPort),
    OUTBOX_WORKER_ENABLED: 'false',
    BOOKING_RECONCILIATION_WORKER_ENABLED: 'false',
  };

  await runChecked(
    pnpmCommand,
    [...pnpmPrefix, '--filter', '@eventory/api', 'db:migrate'],
    testEnvironment,
    'Applying integration migrations',
  );
  await runChecked(
    pnpmCommand,
    [...pnpmPrefix, '--filter', '@eventory/api', 'test'],
    testEnvironment,
    'Running API integration tests',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Integration test runner failed');
  process.exitCode = 1;
} finally {
  if (cleanupRequired) {
    const cleanup = await run('docker', composeArgs('down', '--volumes', '--remove-orphans'));
    if (cleanup.code !== 0) process.exitCode = 1;
  }
}
