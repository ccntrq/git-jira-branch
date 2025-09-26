import {execSync, type SpawnSyncReturns, spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Brand} from 'effect';

export type Directory = string & Brand.Brand<'Directory'>;
export const Directory = Brand.nominal<Directory>();

export const setupTmpDir = async (): Promise<
  readonly [Directory, () => void]
> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'git-jira-branch-e2e-'));
  // biome-ignore lint/suspicious/noConsole: log statement okay in this test
  console.debug(`Setting up e2e env in ${tmpDir}`);

  execSync('git init', {cwd: tmpDir});

  execSync('git config user.email "lester-tester@example.com"', {
    cwd: tmpDir,
  });
  execSync('git config user.name "Lester Tester"', {cwd: tmpDir});
  execSync('git commit -m "init" --allow-empty', {cwd: tmpDir});

  const cleanup = () => {
    // biome-ignore lint/suspicious/noConsole: log statement okay in test
    console.debug(`Cleaning up e2e env in ${tmpDir}`);
    rmSync(tmpDir, {force: true, recursive: true});
  };

  return [Directory(tmpDir), cleanup] as const;
};

const defaultBinarySpec = {
  command: process.execPath,
  args: [fileURLToPath(new URL('../dist/main.js', import.meta.url))],
} as const;

const tokenize = (command: string): Array<string> =>
  command
    .match(/"[^"]*"|'[^']*'|\S+/g)
    ?.map((part) => part.replace(/^['"]|['"]$/g, '')) ?? [];

const resolveBinarySpec = (): {
  command: string;
  args: Array<string>;
  display: string;
} => {
  const override = process.env.GIT_JB_BIN?.trim();
  if (override && override.length > 0) {
    const [command, ...rest] = tokenize(override);
    if (command) {
      return {command, args: rest, display: 'git-jira-branch'};
    }
  }
  return {
    command: defaultBinarySpec.command,
    args: [...defaultBinarySpec.args],
    display: 'git-jira-branch',
  };
};

const binarySpec = resolveBinarySpec();

export const runApp = (dir: Directory, ...args: Array<string>): string =>
  execSyncWithFriendlyMessage(binarySpec, dir, args).toString();

export const spawnApp = (
  dir: Directory,
  ...args: Array<string>
): SpawnSyncReturns<Buffer> =>
  spawnSync(binarySpec.command, [...binarySpec.args, ...args], {
    cwd: dir,
    shell: true,
  });

const execSyncWithFriendlyMessage = (
  spec: {command: string; args: Array<string>; display: string},
  cwd: Directory,
  args: Array<string>,
): Buffer => {
  const commandArgs = [...spec.args, ...args];
  const actualCommand = [spec.command, ...commandArgs].join(' ');
  const displayCommand = [spec.display, ...args].join(' ').trim();
  try {
    return execSync(actualCommand, {cwd});
  } catch (error) {
    if (error instanceof Error && actualCommand.length > 0 && displayCommand) {
      error.message = error.message.replace(actualCommand, displayCommand);
    }
    throw error;
  }
};

export const currentBranch = (dir: Directory): string =>
  execSync('git branch --show-current', {cwd: dir}) //
    .toString()
    .trim();

export const createBranch = (dir: Directory, name: string): string =>
  execSync(`git checkout -b ${name}`, {cwd: dir}) //
    .toString()
    .trim();

export const switchBranch = (dir: Directory, name: string): string =>
  execSync(`git switch ${name}`, {cwd: dir}) //
    .toString()
    .trim();

export const createCommit = (dir: Directory, message: string): string =>
  execSync(`git commit -m "${message}" --allow-empty`, {cwd: dir}) //
    .toString()
    .trim();
