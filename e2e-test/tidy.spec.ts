import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  createCommit,
  setupTmpDir,
  spawnApp,
  switchBranch,
} from './util';

describe('git-jira-branch tidy', () => {
  let tmpDir: Directory;
  const tidyCommand = (...args: Array<string>) =>
    spawnApp(tmpDir, 'tidy', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('starts app and outputs help', async () => {
    const res = tidyCommand('--help');
    expect(res.stdout).toMatch(/git-jira-branch/);
  });

  it('tidies fully merged branch', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    switchBranch(tmpDir, 'master');
    // test
    expect(tidyCommand().output).toMatchInlineSnapshot(`
      [
        null,
        "Deleted branches: [
      feat/GCJB-3-done-ticket
      ]
      ",
        "",
      ]
    `);
  });

  it("doesn't tidy not fully merged branch", async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    createCommit(tmpDir, 'not fully merged');
    switchBranch(tmpDir, 'master');
    // test
    const res = spawnApp(tmpDir, 'tidy').output;
    expect(res).toMatchInlineSnapshot(`
      [
        null,
        "No branches deleted.
      ",
        "Branch for ticket 'GCJB-3' 'feat/GCJB-3-done-ticket' is not fully merged. If you are sure you want to delete run with '-f'
      ",
      ]
    `);
  });

  it('tidies not fully merged branch with --force', async () => {
    // setup
    createBranch(tmpDir, 'feat/GCJB-1-test-branch');
    createBranch(tmpDir, 'feat/GCJB-3-done-ticket');
    createCommit(tmpDir, 'not fully merged');
    switchBranch(tmpDir, 'master');
    // test
    expect(tidyCommand('--force').output).toMatchInlineSnapshot(`
      [
        null,
        "Deleted branches: [
      feat/GCJB-3-done-ticket
      ]
      ",
        "",
      ]
    `);
  });
});
