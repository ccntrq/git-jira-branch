import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  createCommit,
  runApp,
  setupTmpDir,
  switchBranch,
} from './util';

describe('git-jira-branch delete', () => {
  let tmpDir: Directory;
  const deleteCommand = (...args: Array<string>) =>
    runApp(tmpDir, 'delete', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('starts app and outputs help', async () => {
    const res = await deleteCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });
  it('deletes fully merged branch', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1111-test-branch');
    switchBranch(tmpDir, 'master');
    // test
    expect(deleteCommand('1111')).resolves.toMatchInlineSnapshot(`
      "Deleted branch: 'feat/GCJB-1111-test-branch'
      "
    `);
  });

  it("doesn't delete not fully merged branch without --force", async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1111-test-branch');
    createCommit(tmpDir, 'Test commit');
    switchBranch(tmpDir, 'master');
    // test
    try {
      await deleteCommand('1111');
      expect.unreachable('Should have failed');
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `
        [Error: Command failed: git-jira-branch delete 1111
        [0;31mBranch not fully merged 'feat/GCJB-1111-test-branch'. 
        - If you are sure you want to delete retry with \`--force\`              
                      [0m

        ]
      `,
      );
    }
  });

  it('deletes not fully merged branch with --force', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1111-test-branch');
    createCommit(tmpDir, 'Test commit');
    switchBranch(tmpDir, 'master');
    // test
    expect(deleteCommand('--force', '1111')).resolves.toMatchInlineSnapshot(`
      "Deleted branch: 'feat/GCJB-1111-test-branch'
      "
    `);
  });
});
