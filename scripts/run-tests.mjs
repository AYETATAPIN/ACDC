import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const TEST_ROOT = 'test';

const collectTests = (directory) => {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const absolute = join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      files.push(...collectTests(absolute));
      continue;
    }
    if (entry.endsWith('.test.ts')) {
      files.push(relative(process.cwd(), absolute));
    }
  }

  return files;
};

let tests = [];
try {
  tests = collectTests(TEST_ROOT);
} catch (error) {
  console.error('Failed to discover tests:', error.message);
  process.exit(1);
}

if (tests.length === 0) {
  console.log('No test files found.');
  process.exit(0);
}

const result = spawnSync(process.execPath, ['--test', '--import', 'tsx', '--test-concurrency=1', ...tests], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
