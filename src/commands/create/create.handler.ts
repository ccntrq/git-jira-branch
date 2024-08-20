import {Effect, Option, pipe} from 'effect';
import {constant} from 'effect/Function';
import type {AppConfigService} from '../../services/app-config';
import {
  type CustomizationsError,
  CustomizationsService,
} from '../../services/customizations';
import {GitClient} from '../../services/git-client';
import {JiraClient} from '../../services/jira-client';
import {
  CreatedBranch,
  type GitCreateJiraBranchResult,
  type GitJiraBranchError,
  type JiraIssue,
  type JiraIssuetype,
  ResetBranch,
  UsageError,
} from '../../types';
import {getAssociatedBranch} from '../../utils/associated-branch';
import {fullJiraKey} from '../../utils/jira-key';
import {slugify} from '../../utils/slugger';

export const gitCreateJiraBranch = (
  jiraKey: string,
  type: Option.Option<string>,
  baseBranch: Option.Option<string>,
  reset: boolean,
): Effect.Effect<
  GitCreateJiraBranchResult,
  GitJiraBranchError | CustomizationsError,
  AppConfigService | GitClient | JiraClient | CustomizationsService
> =>
  Effect.gen(function* () {
    const [gitClient, jiraClient] = yield* Effect.all([GitClient, JiraClient]);

    const fullKey = yield* fullJiraKey(jiraKey);
    const associatedBranch = yield* getAssociatedBranch(fullKey);

    if (!reset && Option.isSome(associatedBranch)) {
      yield* Effect.fail(
        UsageError({
          message: `A branch for ticket '${fullKey}' already exists: ${associatedBranch.value.name}`,
        }),
      );
    }

    const branchName = yield* pipe(
      associatedBranch,
      Option.match({
        onNone: () =>
          pipe(
            jiraClient.getJiraIssue(fullKey),
            Effect.flatMap((issue) => jiraIssueToBranchName(issue, type)),
          ),
        onSome: (branch) => Effect.succeed(branch.name),
      }),
    );

    const resetBranch = reset && Option.isSome(associatedBranch);
    yield* Option.match(baseBranch, {
      onNone: constant(gitClient.createGitBranch),
      onSome: gitClient.createGitBranchFrom,
    })(branchName, resetBranch);

    return (resetBranch ? ResetBranch : CreatedBranch)({branch: branchName});
  });

const jiraIssueToBranchName = (issue: JiraIssue, type: Option.Option<string>) =>
  Option.map(type, (t) => Effect.succeed(t))
    .pipe(
      Option.getOrElse(() => jiraIssuetypeBranchtype(issue.fields.issuetype)),
    )
    .pipe(
      Effect.map(
        (branchtype) =>
          `${branchtype}/${issue.key}-${slugify(issue.fields.summary)}`,
      ),
    );

const jiraIssuetypeBranchtype = (issuetype: JiraIssuetype) =>
  Effect.gen(function* () {
    const customizations = yield* Effect.flatMap(
      CustomizationsService,
      (cs) => cs.customizations,
    );

    return pipe(
      customizations.issuetypeToBranchtype.get(issuetype.name.toLowerCase()),
      Option.fromNullable,
      Option.getOrElse(() => customizations.defaultBranchtype),
    );
  });
