import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  createCommit,
  execApp,
  setupTmpDir,
  switchBranch,
} from './util';

describe('git-jira-branch tidy', () => {
  let tmpDir: Directory;
  const tidyCommand = (...args: Array<string>) =>
    execApp(tmpDir, 'tidy', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('starts app and outputs help', async () => {
    const res = await tidyCommand('--help');
    expect(res.stdout).toMatch(/git-jira-branch/);
  });

  it('tidies fully merged branch', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    switchBranch(tmpDir, 'master');
    // test
    const res = await tidyCommand();
    expect(res).toMatchInlineSnapshot(`
      {
        "stderr": "",
        "stdout": "Deleted branches: [
      feat/GCJB-3-done-ticket
      ]
      ",
      }
    `);
  });

  it("doesn't tidy not fully merged branch", async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    createCommit(tmpDir, 'not fully merged');
    switchBranch(tmpDir, 'master');
    // test
    const res = await tidyCommand();
    expect(res).toMatchInlineSnapshot(`
      {
        "stderr": "Branch for ticket 'GCJB-3' 'feat/GCJB-3-done-ticket' is not fully merged. If you are sure you want to delete run with '-f'
      ",
        "stdout": "No branches deleted.
      ",
      }
    `);
  });

  it('tidies not fully merged branch with --force', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    createCommit(tmpDir, 'not fully merged');
    switchBranch(tmpDir, 'master');
    // test
    expect(tidyCommand('--force')).resolves.toMatchInlineSnapshot(`
      {
        "stderr": "",
        "stdout": "Deleted branches: [
      feat/GCJB-3-done-ticket
      ]
      ",
      }
    `);
  });
});
