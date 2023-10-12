import { Console, Effect } from "effect";
import { isNone, isSome, type Option } from "effect/Option";

import { GitClient } from "./git-client";
import { JiraClient } from "./jira-client";
import { JiraIssue, JiraIssuetype, JiraKeyPrefix } from "./types";
import { Environment } from "./environment";

const slugify = (str: string): string =>
  str
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const jiraIssueToBranchName = (issue: JiraIssue): string => {
  const branchtype = jiraIssuetypeBranchtype(issue.fields.issuetype);
  return `${branchtype}/${issue.key}-${slugify(issue.fields.summary)}`;
};

const jiraIssuetypeBranchtype = (issuetype: JiraIssuetype): string => {
  if (issuetype.name.match(/bug/i)) {
    return "fix";
  }

  return "feat";
};

const buildJiraKey = (
  defaultJiraKeyPrefix: Option<JiraKeyPrefix>,
  jiraKey: string
): string =>
  jiraKey.match(/^([a-z]+)-(\d+)$/i) || isNone(defaultJiraKeyPrefix)
    ? jiraKey
    : `${defaultJiraKeyPrefix.value}-${jiraKey}`;

export const program = (jiraKey: string, baseBranch: Option<string>) =>
  Effect.all([Environment, GitClient, JiraClient]).pipe(
    Effect.flatMap(([env, gitClient, jiraClient]) =>
      env.getEnv().pipe(
        Effect.map(({ defaultJiraKeyPrefix }) =>
          buildJiraKey(defaultJiraKeyPrefix, jiraKey)
        ),
        Effect.flatMap(jiraClient.getJiraIssue),
        Effect.map(jiraIssueToBranchName),
        Effect.tap(
          isSome(baseBranch)
            ? gitClient.createGitBranchFrom(baseBranch.value)
            : gitClient.createGitBranch
        )
      )
    )
  );
