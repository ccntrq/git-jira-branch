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

export interface AssociatedBranch extends GitBranch {
  jiraKey: string;
}

export const AssociatedBranch = Data.case<AssociatedBranch>();

export const JiraIssuetypeSchema = Schema.Struct({
  name: Schema.String,
});

export type JiraIssuetype = Schema.Schema.Type<typeof JiraIssuetypeSchema>;

// TODO: transform nullable values into optionals
export const JiraIssueSchema = Schema.Struct({
  key: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    issuetype: JiraIssuetypeSchema,
    status: Schema.Struct({
      name: Schema.String,
    }),
    description: Schema.NullOr(Schema.String),
    assignee: Schema.NullOr(
      Schema.Struct({
        displayName: Schema.String,
      }),
    ),
    creator: Schema.Struct({
      displayName: Schema.String,
    }),
  }),
});

export type JiraIssue = Schema.Schema.Type<typeof JiraIssueSchema>;

export type GitCreateJiraBranchResult = Data.TaggedEnum<{
  CreatedBranch: {branch: string};
  SwitchedBranch: {branch: string};
  DeletedBranch: {branch: string};
  ResetBranch: {branch: string};
}>;

export const {CreatedBranch, SwitchedBranch, DeletedBranch, ResetBranch} =
  Data.taggedEnum<GitCreateJiraBranchResult>();

export type SwitchedBranch = ReturnType<typeof SwitchedBranch>;
export type CreatedBranch = ReturnType<typeof CreatedBranch>;
export type ResetBranch = ReturnType<typeof ResetBranch>;
export type DeletedBranch = ReturnType<typeof DeletedBranch>;

export const matchGitCreateJiraBranchResult: {
  <A>(
    result: GitCreateJiraBranchResult,
    matcher: {
      onCreatedBranch: (branch: CreatedBranch) => A;
      onSwitchedBranch: (branch: SwitchedBranch) => A;
      onDeletedBranch: (branch: DeletedBranch) => A;
      onResetBranch: (branch: ResetBranch) => A;
    },
  ): A;
  <A>(matcher: {
    onCreatedBranch: (branch: CreatedBranch) => A;
    onSwitchedBranch: (branch: SwitchedBranch) => A;
    onDeletedBranch: (branch: DeletedBranch) => A;
    onResetBranch: (branch: ResetBranch) => A;
  }): (result: GitCreateJiraBranchResult) => A;
} = dual(
  2,
  <A>(
    result: GitCreateJiraBranchResult,
    matcher: {
      onCreatedBranch: (branch: CreatedBranch) => A;
      onSwitchedBranch: (branch: SwitchedBranch) => A;
      onDeletedBranch: (branch: DeletedBranch) => A;
      onResetBranch: (branch: ResetBranch) => A;
    },
  ): A =>
    pipe(
      Match.type<GitCreateJiraBranchResult>(),
      Match.tag('CreatedBranch', (res) => matcher.onCreatedBranch(res)),
      Match.tag('SwitchedBranch', (res) => matcher.onSwitchedBranch(res)),
      Match.tag('ResetBranch', (res) => matcher.onResetBranch(res)),
      Match.tag('DeletedBranch', (res) => matcher.onDeletedBranch(res)),
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
