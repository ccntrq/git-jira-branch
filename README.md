# git-create-jira-branch - Setup feature branches for your Jira tickets with one command.

Creates feature branches based on your Jira tickets type and description.

```bash
$ git create-ticket-branch MYAPP-1234 -b master
> Successfully created branch: 'feat/MYAPP-1234-sluggified-description-used-as-branchname'
```

## Installation and Usage

### Install

The cli can be installed from `npm`. It assumes you have git installed on your
system and the `git` command to be available on your `$PATH`.

```bash
npm i -g git-create-jira-branch
```

### Configuration

1. Create a Jira PAT (Personal Access Token) [See Jira
   Docs](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
1. Add the created Jira PAT, the base url of your Jira instance and optionally a
   default Jira key prefix to your environment.
   For example in your `.bashrc` or `.zshrc`:
   ```bash
   export JIRA_PAT="YOUR_PERSONAL_ACCESS_TOKEN"
   export JIRA_API_URL="https://jira.mycompany.com"
   export JIRA_KEY_PREFIX="MYAPP"
   ```

### Usage

#### Create a new branch from your current `HEAD`

Using the default JIRA_KEY_PREFIX

```bash
git-create-ticket-branch 1324
```

Or fully specified:

```
git-create-ticket-branch MYAPP-1234
```

#### Create a new branch based on some other revision

To create a new branch based on your `master` branch:

```bash
git-create-ticket-branch MYAPP-1234 -b master
```

## Technologies used

This project was started as an excuse to explore the
[Effect](https://effect.website/) ecosystem and was written with only
`@effect/*` packages as it's runtime dependencies. It uses:

| Package                                                        | Usage                                     |
| -------------------------------------------------------------- | ----------------------------------------- |
| [effect](https://github.com/Effect-TS/effect)                  | The core effect system and runtime.       |
| [@effect/cli](https://github.com/Effect-TS/cli)                | Command line handling and option parsing. |
| [@effect/platform](https://github.com/Effect-TS/platform)      | For its http client.                      |
| [@effect/platform-node](https://github.com/Effect-TS/platform) | For its shell command executor.           |

It uses the Jira API to fetch the details for a ticket and calls out directly to `git` for branch creation.

Tests were written using [`vitest`](https://vitest.dev). The testsuite can be run using `npm run test`.
