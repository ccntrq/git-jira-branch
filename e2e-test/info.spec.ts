import {beforeEach, describe, expect, it} from 'vitest';
import {createBranch, type Directory, runApp, setupTmpDir} from './util.js';

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
    const res = infoCommand('--help');
    expect(res).toMatch(/git-jira-branch/);
  });

  it('prints ticket info for given ticket', () => {
    const result = infoCommand('1');
    expect(result).toMatchSnapshot();
  });

  it('info subcommand prints ticket info for current branch', () => {
    createBranch(tmpDir, 'feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary');
    const result = infoCommand();
    expect(result).toMatchSnapshot();
  });
});
