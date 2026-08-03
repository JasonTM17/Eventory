import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceRoot = resolve(import.meta.dirname, '..');
const requiredPackageFiles = ['LICENSE'];
const packageSpecs = [
  {
    directory: 'packages/config',
    files: [
      'dist/environment.d.ts',
      'dist/environment.d.ts.map',
      'dist/environment.js',
      'dist/environment.js.map',
      'dist/index.d.ts',
      'dist/index.d.ts.map',
      'dist/index.js',
      'dist/index.js.map',
      'package.json',
    ],
  },
  {
    directory: 'packages/contracts',
    files: ['package.json', 'src/index.ts'],
  },
  {
    directory: 'packages/ui',
    files: ['package.json', 'src/index.tsx'],
  },
  {
    directory: 'packages/eslint-config',
    files: ['index.js', 'package.json'],
  },
  {
    directory: 'packages/typescript-config',
    files: ['base.json', 'nestjs.json', 'nextjs.json', 'package.json'],
  },
];

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertEqualFiles(packageName, actual, expected) {
  const actualFiles = sorted(actual);
  const expectedFiles = sorted(expected);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `${packageName} payload mismatch\nexpected: ${expectedFiles.join(', ')}\nactual: ${actualFiles.join(', ')}`,
    );
  }
}

for (const spec of packageSpecs) {
  const packageDirectory = resolve(workspaceRoot, spec.directory);
  const manifest = JSON.parse(readFileSync(resolve(packageDirectory, 'package.json'), 'utf8'));
  if (manifest.private !== true) throw new Error(`${manifest.name} must remain private`);
  if (manifest.license !== 'MIT') throw new Error(`${manifest.name} must declare the MIT license`);

  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
  const commandArguments =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'pnpm pack --dry-run --json']
      : ['pack', '--dry-run', '--json'];
  const result = spawnSync(command, commandArguments, {
    cwd: packageDirectory,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${manifest.name} pack failed\n${result.stderr || result.stdout}`);
  }

  const payload = JSON.parse(result.stdout);
  const actualFiles = payload.files.map((file) => file.path);
  assertEqualFiles(manifest.name, actualFiles, [...spec.files, ...requiredPackageFiles]);

  for (const entrypoint of [manifest.main, manifest.types]) {
    if (entrypoint && !actualFiles.includes(entrypoint)) {
      throw new Error(`${manifest.name} omits declared entrypoint ${entrypoint}`);
    }
  }

  console.log(`${manifest.name}: ${actualFiles.join(', ')}`);
}
