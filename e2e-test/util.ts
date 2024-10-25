import type {ExecOptions} from 'node:child_process';
import {exec, execSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Brand} from 'effect';

function execPromise(
  command: string,
  options: ExecOptions,
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    exec(command, {...options, encoding: 'utf-8'}, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({stdout, stderr});
    });
  });
}

export type Directory = string & Brand.Brand<'Directory'>;
export const Directory = Brand.nominal<Directory>();

export const setupTmpDir = async (): Promise<
  readonly [Directory, () => void]
> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'git-jira-branch-e2e-'));
  // biome-ignore lint/nursery/noConsole: log statement okay in this test
  console.debug(`Setting up e2e env in ${tmpDir}`);

  execSync('git init', {cwd: tmpDir});

  execSync('git config user.email "lester-tester@example.com"', {
    cwd: tmpDir,
  });
  execSync('git config user.name "Lester Tester"', {cwd: tmpDir});
  execSync('git commit -m "init" --allow-empty', {cwd: tmpDir});

  const cleanup = () => {
    // biome-ignore lint/nursery/noConsole: log statement okay in test
    console.debug(`Cleaning up e2e env in ${tmpDir}`);
    rmSync(tmpDir, {force: true, recursive: true});
  };

  return [Directory(tmpDir), cleanup] as const;
};

export const runApp = async (
  dir: Directory,
  ...args: Array<string>
): Promise<string> => {
  const cmd = `git-jira-branch ${args.join(' ')}`;
  const res = await execPromise(cmd, {cwd: dir});
  return res.stdout;
};

export const execApp = async (
  dir: Directory,
  ...args: Array<string>
): Promise<{stdout: string; stderr: string}> => {
  const cmd = `git-jira-branch ${args.join(' ')}`;
  const res = await execPromise(cmd, {cwd: dir});
  return res;
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
