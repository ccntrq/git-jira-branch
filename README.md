# git-create-jira-branch - Create git branches for your Jira tickets

## Usage

- create a Jira PAT (Personal Access Token) [Docs](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html)
- add PAT, the base url of your jira instance and optionally a default jira key prefix to your environment.
  ```bash
  export JIRA_PAT="YOUR_PERSONAL_ACCESS_TOKEN"
  export JIRA_API_URL="https://jira.mycompany.com"
  export JIRA_KEY_PREFIX="MYAPP"
  ```
- run to create a new branch from your current `HEAD`
  ```bash
  $ git-create-ticket-branch 1324
  # or
  $ git-create-ticket-branch MYAPP-1234
  ```
- run to create a new branch from your `master` branch
  ```bash
  $ git-create-ticket-branch 1324 -b master
  # or
  $ git-create-ticket-branch MYAPP-1234A -b master
  ```