module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(commit) => commit.match(/Signed-off-by: dependabot\[bot]/)],
};
