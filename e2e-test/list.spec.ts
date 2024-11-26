import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Directory,
  createBranch,
  runApp,
  setupTmpDir,
  switchBranch,
} from './util';

describe('git-jira-branch list', () => {
  let tmpDir: Directory;
  const listCommand = (...args: Array<string>) =>
    runApp(tmpDir, 'list', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('starts app and outputs help', async () => {
    const res = await listCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('list subcommand prints associated branches with current', async () => {
    await createBranch(tmpDir, 'feat/GCJB-1-test-ticket-1');
    await createBranch(tmpDir, 'feat/GCJB-2-test-ticket-2');
    await createBranch(tmpDir, 'feat/GCJB-3-test-ticket-3-current');

    return expect(listCommand()).resolves.toMatchSnapshot();
  });

  it('list subcommand prints associated branches without current', async () => {
    await createBranch(tmpDir, 'feat/GCJB-1-test-ticket-1');
    await createBranch(tmpDir, 'feat/GCJB-2-test-ticket-2');
    await createBranch(tmpDir, 'feat/GCJB-3-test-ticket-3');
    await switchBranch(tmpDir, 'master');

    return expect(listCommand()).resolves.toMatchSnapshot();
  });
});
