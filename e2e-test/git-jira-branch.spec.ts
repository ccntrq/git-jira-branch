import {execSync} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Brand} from 'effect';
import {beforeAll, describe, expect, it} from 'vitest';

type Directory = string & Brand.Brand<'Directory'>;
const Directory = Brand.nominal<Directory>();

const setupTmpDir = async (): Promise<Directory> => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'git-jira-branch-e2e-'));
  // biome-ignore lint/nursery/noConsole: log statement okay in this test
  console.log(`Setting up e2e env in ${tmpDir}`);

  execSync('git init', {cwd: tmpDir});

  execSync('git config user.email "lester-tester@example.com"', {
    cwd: tmpDir,
  });
  execSync('git config user.name "Lester Tester"', {cwd: tmpDir});
  execSync('git commit -m "init" --allow-empty', {cwd: tmpDir});

  return Directory(tmpDir);
};

const runApp = (dir: Directory, ...args: Array<string>): string => {
  const cmd = `git-jira-branch ${args.join(' ')}`;
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
    try {
      runApp(tmpDir, 'create', 'NOPROJECT-1');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toMatchInlineSnapshot(
        '[Error: Command failed: git-jira-branch create NOPROJECT-1]',
      );
      return;
    }
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

  it('switch subcommand switches to already existing branch', async () => {
    const res = runApp(tmpDir, 'switch', 'GCJB-1');

    expect(res).toMatchInlineSnapshot(`
      "Switched to already existing branch: 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary'
      "
    `);
    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"',
    );
  });

  it('switch subcommand fails on non existing branches', async () => {
    try {
      runApp(tmpDir, 'switch', 'GCJB-5');
      expect.unreachable('Should have thrown');
      // biome-ignore lint/suspicious/noExplicitAny: any is okay in this test
    } catch (error: any) {
      expect(error?.stdout.toString()).toMatchInlineSnapshot(`
        "[0;31mNo branch associated with Jira ticket 'GCJB-5'[0m

        "
      `);
      return;
    }
  });

  it('info subcommand prints ticket info for given ticket', () => {
    const result = runApp(tmpDir, 'info', '1');
    expect(result).toMatchSnapshot();
  });

  it('info subcommand prints ticket info for current branch', () => {
    execSync('git switch "feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"', {
      cwd: tmpDir,
    });
    const result = runApp(tmpDir, 'info');
    expect(result).toMatchSnapshot();
  });

  it('list subcommand prints associated branches with current', () => {
    execSync('git switch "feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"', {
      cwd: tmpDir,
    });
    const result = runApp(tmpDir, 'list');
    expect(result).toMatchSnapshot();
  });

  it('list subcommand prints associated branches without current', () => {
    execSync('git switch master', {
      cwd: tmpDir,
    });
    const result = runApp(tmpDir, 'list');
    expect(result).toMatchSnapshot();
  });
});
