import {execSync} from 'node:child_process';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  createBranch,
  currentBranch,
  type Directory,
  runApp,
  setupTmpDir,
} from './util.js';

describe('git-jira-branch switch', () => {
  let tmpDir: Directory;
  const switchCommand = (...args: Array<string>) =>
    runApp(tmpDir, 'switch', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('outputs help', async () => {
    const res = switchCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('switches to already existing branch', async () => {
    createBranch(tmpDir, 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary');

    const res = switchCommand('GCJB-1');

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
      const _res = switchCommand('GCJB-5');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toMatchInlineSnapshot(`
        [Error: Command failed: git-jira-branch switch GCJB-5
        [0;31mNo branch associated with Jira ticket 'GCJB-5'[0m

        ]
      `);
      return;
    }
  });

  it('switches to branch that only exists on remote (after fetch)', async () => {
    const defaultBranch = currentBranch(tmpDir);
    const remotePath = join(tmpDir, 'remote.git');
    execSync(`git init --bare ${remotePath}`);
    execSync(`git remote add origin ${remotePath}`, {cwd: tmpDir});

    const remoteBranch = 'feat/GCJB-2-remote-only-branch';
    createBranch(tmpDir, remoteBranch);
    execSync(`git push origin -u ${remoteBranch}`, {cwd: tmpDir});
    execSync(`git checkout ${defaultBranch}`, {cwd: tmpDir});
    execSync(`git branch -D ${remoteBranch}`, {cwd: tmpDir});
    execSync('git fetch', {cwd: tmpDir});

    const res = switchCommand('GCJB-2');

    expect(res).toMatchInlineSnapshot(`
      "Branch 'feat/GCJB-2-remote-only-branch' set up to track remote branch.
      Switched to a new branch 'feat/GCJB-2-remote-only-branch'.
      "
    `);
    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-2-remote-only-branch"',
    );
  });
});
