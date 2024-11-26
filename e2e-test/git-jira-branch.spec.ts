import {beforeEach, describe, expect, it} from 'vitest';
import {type Directory, runApp, setupTmpDir} from './util';

describe('git-jira-branch', () => {
  let tmpDir: Directory;

  beforeEach(async () => {
    const [dir, cleanup] = await setupTmpDir();
    tmpDir = dir;
    return cleanup;
  });

  it('starts app and outputs help', async () => {
    const res = await runApp(tmpDir, '--help');
    expect(res).toMatch(/git-jira-branch/);
  });
});
