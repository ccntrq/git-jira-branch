module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [(commit) => commit.match(/^chore\(deps.*\): bump the/)],
};
