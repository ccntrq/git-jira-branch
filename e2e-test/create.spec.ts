import {execSync} from 'node:child_process';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  createCommit,
  currentBranch,
  runApp,
  setupTmpDir,
} from './util';

describe('git-jira-branch create', () => {
  let tmpDir: Directory;
  const createCommand = (...args: Array<string>) =>
    runApp(tmpDir, 'create', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('outputs help', async () => {
    const res = await createCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('creates new branch for existing jira ticket', async () => {
    const res = await createCommand('GCJB-1');

    expect(res).toMatchInlineSnapshot(`
      "Successfully created branch: 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary'
      "
    `);

    expect(currentBranch(tmpDir)).toMatchInlineSnapshot(
      '"feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary"',
    );
  });

  it('create subcommand prints error for non existing jira ticket', async () => {
    try {
      await createCommand('NOPROJECT-1');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toMatchInlineSnapshot(`
        [Error: Command failed: git-jira-branch create NOPROJECT-1
        [0;31mJira returned status 404. Make sure the ticket with id NOPROJECT-1 exists.[0m

        ]
      `);
      return;
    }
  });

  it('create subcommand fails for already existing branch', async () => {
    createBranch(tmpDir, 'feat/GCJB-1-already-exists');

    try {
      await createCommand('GCJB-1');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        [Error: Command failed: git-jira-branch create GCJB-1
        [0;31mA branch for ticket 'GCJB-1' already exists: feat/GCJB-1-already-exists[0m

        ]
      `);
    }
  });

  it('create subcommand resets branch to given base ref', () => {
    createBranch(tmpDir, 'feat/GCJB-1-already-exists');
    createCommit(tmpDir, 'To be reset');

    expect(
      createCommand('--reset', '-b', 'master', 'GCJB-1'),
    ).resolves.toMatchInlineSnapshot(`
      "Reset branch: 'feat/GCJB-1-already-exists'
      "
    `);

    const lastCommitMsg2 = execSync('git log -1 --pretty=%B', {cwd: tmpDir})
      .toString()
      .trim();
    expect(lastCommitMsg2).toMatchInlineSnapshot(`"To be reset"`);
  });
});
