<p align="center">
  <img
    width="256px"
    title="git-jira-branch Logo"
    alt="git-jira-branch Logo"
    src="./assets/logo.webp"
  >
</p>

# git-jira-branch - Manage branches for your Jira tickets

Creates feature branches based on your Jira tickets type and description.

```bash
$ git jira-branch create MYAPP-1234
> Successfully created branch: 'feat/MYAPP-1234-sluggified-description-used-as-branchname'
```
<!-- vscode-markdown-toc -->
* [Usage](#Usage)
	* [Create a new branch from your current `HEAD`](#CreateanewbranchfromyourcurrentHEAD)
	* [Create a new branch based on some other revision](#Createanewbranchbasedonsomeotherrevision)
	* [Reset an already existing branch](#Resetanalreadyexistingbranch)
	* [Open tickets in your browser](#Openticketsinyourbrowser)
	* [Show ticket info on your terminal](#Showticketinfoonyourterminal)
	* [List branches associated with jira tickets](#Listbranchesassociatedwithjiratickets)
	* [`wizard` mode](#wizardmode)
* [Setup](#Setup)
	* [Install](#Install)
	* [Configuration](#Configuration)
		* [For Jira Cloud](#ForJiraCloud)
		* [For Jira Data Center](#ForJiraDataCenter)
	* [Setup shell completions](#Setupshellcompletions)
* [Technologies used](#Technologiesused)

<!-- vscode-markdown-toc-config
	numbering=false
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

## <a name='Usage'></a>Usage

Since this command starts with `git-` all commands can be run via
`git-jira-branch` or as a git subcommand with `git jira-branch`.

Due to a limitation in the awesome [cli
library](https://github.com/Effect-TS/cli) used, all options must be passed
before the jira ticket key argument.

### <a name='CreateanewbranchfromyourcurrentHEAD'></a>Create a new branch from your current `HEAD`

Using the default JIRA_KEY_PREFIX

```bash
git-jira-branch create 1324
```

Or fully specified:

```bash
git-jira-branch create MYAPP-1234
```

### <a name='Createanewbranchbasedonsomeotherrevision'></a>Create a new branch based on some other revision

To create a new branch based on your `master` branch:

```bash
git-jira-branch create -b master MYAPP-1234
```

### <a name='Resetanalreadyexistingbranch'></a>Reset an already existing branch

Pass the `-r|--reset` flag to reset an already existing branch to the current
`HEAD` or the specified base revision (with `-b`)

```bash
git-jira-branch create -r MYAPP-1234
```

### <a name='Openticketsinyourbrowser'></a>Open tickets in your browser

1. For the current branch:
   ```bash
   $ git jira-branch open
   > Opening ticket url 'https://gcjb.atlassian.net/browse/GCJB-164' in your default browser...
   ```
2. For a given ticket:
   ```bash
   $ git jira-branch open GCJB-1234
   > Opening ticket url 'https://gcjb.atlassian.net/browse/GCJB-1234' in your default browser...
   ```

### <a name='Showticketinfoonyourterminal'></a>Show ticket info on your terminal

The `info` command shows the information for ticket nicely rendered for
consumtpion in the terminal.

By default info is show for the ticket associated with the current branch.
Alternatively a ticket key can be passed as an argument to show info for that
ticket.

```bash
$ git jira-branch info
```

Will create output like this:

> <ins>**GCJB-1** - Ticket summary</ins></br>
> <ins>**Task** | **Status**: To Do | **Creator**: Alexander Pankoff | **Assignee**: Alexander Pankoff</ins>
>
> Long lines in the description of the ticket are wrapped to fit a line width of<br>
> 80 characters to make it easier to read.

### <a name='Listbranchesassociatedwithjiratickets'></a>List branches associated with jira tickets

```bash
$ git jira-branch list
> * feat/GCJB-1-e2e-test-ticket-with-a-fancy-summary
>   feat/GCJB-2-another-ticket-that-looks-like-its-associated-with-a-jira-ticket
```

### <a name='wizardmode'></a>`wizard` mode

Use the `--wizard` option to enter `wizard` mode. This will prompt you for the
Jira ticket key and additional options and build the appropriate command line
for you.

```bash
git-jira-branch --wizard
```

## <a name='Setup'></a>Setup

### <a name='Install'></a>Install

The cli can be installed from `npm`. It assumes you have git installed on your
system and the `git` command to be available on your `$PATH`.

```bash
npm i -g git-jira-branch
```

### <a name='Configuration'></a>Configuration

#### <a name='ForJiraCloud'></a>For Jira Cloud

1. Create a Jira API Token [See Jira
   Docs](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
1. Add the created API Token, your login email, the base url of your Jira
   instance and optionally a default Jira key prefix to your environment.
   For example in your `.bashrc` or `.zshrc`:
   ```bash
   export JIRA_USER_EMAIL="YOUR_JIRA_LOGIN_EMAIL"
   export JIRA_API_TOKEN="YOUR_API_TOKEN"
   export JIRA_API_URL="https://jira.mycompany.com"
   export JIRA_KEY_PREFIX="MYAPP"
   ```

#### <a name='ForJiraDataCenter'></a>For Jira Data Center

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

### <a name='Setupshellcompletions'></a>Setup shell completions

The cli can generate shell completion scripts for `bash`,`zsh` and `fish`. To
generate and print the script for your shell run:

```bash
git-jira-branch --completions (bash|zsh|fish)
```

To install the completions for your shell, run the above command and pipe the
output to a file and source it in your shell config.

E.g. for `bash`:

```bash
git-jira-branch --completions bash > ~/.git-jira-branch-bash-completions
echo "source \$HOME/.git-jira-branch-bash-completions" >> ~/.bashrc
source ~/.bashrc
```

## <a name='Technologiesused'></a>Technologies used

This project was started as an excuse to explore the
[Effect](https://effect.website/) ecosystem and was written with only
`@effect/*` packages as it's runtime dependencies. It uses:

| Package                                                        | Usage                                                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [effect](https://github.com/Effect-TS/effect)                  | The core effect system and runtime.                                                                                               |
| [@effect/cli](https://github.com/Effect-TS/cli)                | Command line handling and option parsing.<br>The `wizard` mode and `--completions` option are automatically provided by this lib. |
| [@effect/platform](https://github.com/Effect-TS/platform)      | For its http client.                                                                                                              |
| [@effect/platform-node](https://github.com/Effect-TS/platform) | For its shell command executor.                                                                                                   |

It uses the Jira API to fetch the details for a ticket and calls out directly to `git` for branch creation.

Tests were written using [`vitest`](https://vitest.dev). The testsuite can be run using `npm run test`.
