import * as Schema from '@effect/schema/Schema';
import {Brand, Data, Match, type Option, pipe} from 'effect';
import {dual} from 'effect/Function';

export type JiraApiUrl = string & Brand.Brand<'JiraApiUrl'>;
export const JiraApiUrl = Brand.refined<JiraApiUrl>(
  (s: string) => s.startsWith('https://') || s.startsWith('http://'),
  (s: string) => Brand.error(`'${s}' is not a valid Jira API URL`),
);
export type JiraPat = string & Brand.Brand<'JiraPat'>;
export const JiraPat = Brand.refined<JiraPat>(
  (s: string) => s.length > 0,
  () => Brand.error('Provided value is not a valid Jira PAT'),
);
export type JiraApiToken = string & Brand.Brand<'JiraApiToken'>;
export const JiraApiToken = Brand.refined<JiraApiToken>(
  (s: string) => s.length > 0,
  () => Brand.error('Provided value is not a valid Jira API token'),
);
export type JiraUserEmail = string & Brand.Brand<'JiraUserEmail'>;
export const JiraUserEmail = Brand.refined<JiraUserEmail>(
  // NOTE: This validation does not strictly adhere to the email RFC 2822. It is
  // however sufficient to reject inputs that are obviously not valid email
  // addresses while allowing potentially valid ones.
  (s: string) => /^.+@.+\..+$/.test(s),
  (s: string) => Brand.error(`'${s}' is not a valid email address`),
);
export type JiraKeyPrefix = string & Brand.Brand<'JiraKeyPrefix'>;
export const JiraKeyPrefix = Brand.refined<JiraKeyPrefix>(
  (s: string) => s.length > 0,
  (s: string) => Brand.error(`'${s}' is not a valid Jira key prefix`),
);

export type JiraAuth = Data.TaggedEnum<{
  JiraDataCenterAuth: {jiraPat: JiraPat};
  JiraCloudAuth: {jiraUserEmail: JiraUserEmail; jiraApiToken: JiraApiToken};
}>;

export const {JiraDataCenterAuth, JiraCloudAuth} = Data.taggedEnum<JiraAuth>();

export type AppConfig = {
  jiraApiUrl: JiraApiUrl;
  defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>;
  jiraAuth: JiraAuth;
};

export interface GitBranch {
  name: string;
  isCurrent: boolean;
}

export const GitBranch = Data.case<GitBranch>();

export const JiraIssuetypeSchema = Schema.struct({
  name: Schema.string,
});

export type JiraIssuetype = Schema.Schema.Type<typeof JiraIssuetypeSchema>;

// TODO: transform nullable values into optionals
export const JiraIssueSchema = Schema.struct({
  key: Schema.string,
  fields: Schema.struct({
    summary: Schema.string,
    issuetype: JiraIssuetypeSchema,
    status: Schema.struct({
      name: Schema.string,
    }),
    description: Schema.nullable(Schema.string),
    assignee: Schema.nullable(
      Schema.struct({
        displayName: Schema.string,
      }),
    ),
    creator: Schema.struct({
      displayName: Schema.string,
    }),
  }),
});

export type JiraIssue = Schema.Schema.Type<typeof JiraIssueSchema>;

export type GitCreateJiraBranchResult = Data.TaggedEnum<{
  CreatedBranch: {branch: string};
  SwitchedBranch: {branch: string};
  ResetBranch: {branch: string};
}>;

export const {CreatedBranch, SwitchedBranch, ResetBranch} =
  Data.taggedEnum<GitCreateJiraBranchResult>();

export const matchGitCreateJiraBranchResult: {
  <A>(
    result: GitCreateJiraBranchResult,
    matcher: {
      onCreatedBranch: (branch: string) => A;
      onSwitchedBranch: (branch: string) => A;
      onResetBranch: (branch: string) => A;
    },
  ): A;
  <A>(matcher: {
    onCreatedBranch: (branch: string) => A;
    onSwitchedBranch: (branch: string) => A;
    onResetBranch: (branch: string) => A;
  }): (result: GitCreateJiraBranchResult) => A;
} = dual(
  2,
  <A>(
    result: GitCreateJiraBranchResult,
    matcher: {
      onCreatedBranch: (branch: string) => A;
      onSwitchedBranch: (branch: string) => A;
      onResetBranch: (branch: string) => A;
    },
  ): A =>
    pipe(
      Match.type<GitCreateJiraBranchResult>(),
      Match.tag('CreatedBranch', ({branch}) => matcher.onCreatedBranch(branch)),
      Match.tag('SwitchedBranch', ({branch}) =>
        matcher.onSwitchedBranch(branch),
      ),
      Match.tag('ResetBranch', ({branch}) => matcher.onResetBranch(branch)),
      Match.exhaustive,
    )(result) as A,
);

export type GitJiraBranchError =
  | AppConfigError
  | UsageError
  | GitExecError
  | JiraApiError;

export declare namespace GitJiraBranchError {
  export interface Proto {
    readonly _tag: string;
    readonly message: string;
  }

  export type ProvidedFields = '_tag';
}

const makeError =
  <E extends GitJiraBranchError.Proto>(tag: E['_tag']) =>
  (args: Omit<E, GitJiraBranchError.ProvidedFields>): E =>
    Data.struct({
      _tag: tag,
      ...args,
    } as E);

export interface GitExecError extends GitJiraBranchError.Proto {
  readonly _tag: 'GitExecError';
}

export const GitExecError = makeError<GitExecError>('GitExecError');

export interface UsageError extends GitJiraBranchError.Proto {
  readonly _tag: 'UsageError';
}

export const UsageError = makeError<UsageError>('UsageError');

export interface AppConfigError extends GitJiraBranchError.Proto {
  readonly _tag: 'AppConfigError';
}
export const AppConfigError = makeError<AppConfigError>('AppConfigError');

export const isAppConfigError = (e: unknown): e is AppConfigError =>
  e instanceof Object && '_tag' in e && e._tag === 'AppConfigError';

export interface JiraApiError extends GitJiraBranchError.Proto {
  readonly _tag: 'JiraApiError';
}
export const JiraApiError = makeError<JiraApiError>('JiraApiError');
