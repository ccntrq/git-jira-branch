import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  currentBranch,
  runApp,
  setupTmpDir,
} from './util';

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
    const res = await switchCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('switches to already existing branch', async () => {
    createBranch(tmpDir, 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary');

    const res = await switchCommand('GCJB-1');

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
      const _res = await switchCommand('GCJB-5');
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
});
