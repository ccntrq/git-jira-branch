import {beforeEach, describe, expect, it} from 'vitest';
import {type Directory, createBranch, runApp, setupTmpDir} from './util';

describe('git-jira-branch info', () => {
  let tmpDir: Directory;
  const infoCommand = (...args: Array<string>) =>
    runApp(tmpDir, 'info', ...args);

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });
  it('starts app and outputs help', async () => {
    const res = await infoCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('prints ticket info for given ticket', async () => {
    const result = await infoCommand('1');
    expect(result).toMatchSnapshot();
  });

  it('info subcommand prints ticket info for current branch', async () => {
    createBranch(tmpDir, 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary');
    const result = await infoCommand();
    expect(result).toMatchSnapshot();
  });
});
