import {execSync} from 'child_process';
import {Brand} from 'effect';
import {mkdtemp} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {cwd} from 'process';
import {it, describe, expect, beforeAll} from 'vitest';

type Directory = string & Brand.Brand<'Directory'>;
const Directory = Brand.nominal<Directory>();

const setupTmpDir = async (): Promise<Directory> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'git-jira-branch-e2e-'));
  console.log(`Setting up e2e env in ${tmpDir}`);

  execSync('git init', {cwd: tmpDir});

  execSync('git config user.email "lester-tester@example.com"', {
    cwd: tmpDir,
  });
  execSync('git config user.name "Lester Tester"', {cwd: tmpDir});
  execSync('git commit -m "init" --allow-empty', {cwd: tmpDir});

  return Directory(tmpDir);
};

const runApp = (dir: Directory, ...args: string[]): string => {
  const cmd = `node ${join(cwd(), 'dist', 'main.js')} ${args.join(' ')}`;
  return execSync(cmd, {cwd: dir}).toString();
};

const currentBranch = (dir: Directory): string =>
  execSync('git branch --show-current', {cwd: dir}) //
    .toString()
    .trim();

describe('git-jira-branch', () => {
  let tmpDir: Directory;

  beforeAll(async () => {
    tmpDir = await setupTmpDir();
  });

  it('starts app and outputs help', async () => {
    const res = runApp(tmpDir, '--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('create subcommand prints error for non existing jira ticket', () => {
    const res = runApp(tmpDir, 'create', 'NOPROJECT-1');

    expect(res).toMatchInlineSnapshot(`
      "[0;31mJira returned status 404. Make sure the ticket with id NOPROJECT-1 exists.[0m

      "
    `);
  });

  it('create subcommand creates new branch for existing jira ticket', () => {
    const res = runApp(tmpDir, 'create', 'GCJB-1');

    expect(res).toMatchInlineSnapshot(`
      "Successfully created branch: 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary'
      "
    `);

    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"',
    );
  });

  it('create subcommand switches to already existing branch for existing jira ticket', async () => {
    const res = runApp(tmpDir, 'create', 'GCJB-1');

    expect(res).toMatchInlineSnapshot(`
      "Switched to already existing branch: 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary'
      "
    `);
    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"',
    );
  });

  it('create subcommand resets branch to given base ref', () => {
    runApp(tmpDir, 'create', 'GCJB-1');
    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"',
    );

    execSync('echo test > testFile', {cwd: tmpDir});
    execSync('git add testFile', {cwd: tmpDir});
    execSync('git commit -m "add testFile"', {cwd: tmpDir});
    const lastCommitMsg = execSync('git log -1 --pretty=%B', {cwd: tmpDir})
      .toString()
      .trim();
    expect(lastCommitMsg).toMatchInlineSnapshot('"add testFile"');

    runApp(tmpDir, 'create', '--reset', '-b', 'master', 'GCJB-1');
    const lastCommitMsg2 = execSync('git log -1 --pretty=%B', {cwd: tmpDir})
      .toString()
      .trim();
    expect(lastCommitMsg2).toMatchInlineSnapshot('"init"');
  });
});
