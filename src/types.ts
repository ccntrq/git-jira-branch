// eslint-disable-next-line node/no-extraneous-import
import * as Schema from '@effect/schema/Schema';
import {Brand, Data, Match, Option, pipe} from 'effect';
import {dual} from 'effect/Function';

export type JiraApiUrl = string & Brand.Brand<'JiraApiUrl'>;
export const JiraApiUrl = Brand.nominal<JiraApiUrl>();
export type JiraPat = string & Brand.Brand<'JiraPat'>;
export const JiraPat = Brand.nominal<JiraPat>();
export type JiraApiToken = string & Brand.Brand<'JiraApiToken'>;
export const JiraApiToken = Brand.nominal<JiraApiToken>();
export type JiraUserEmail = string & Brand.Brand<'JiraUserEmail'>;
export const JiraUserEmail = Brand.nominal<JiraUserEmail>();
export type JiraKeyPrefix = string & Brand.Brand<'JiraKeyPrefix'>;
export const JiraKeyPrefix = Brand.nominal<JiraKeyPrefix>();

export type JiraCloudAuth = Data.Data<{
  _tag: 'JiraCloudAuth';
  jiraUserEmail: JiraUserEmail;
  jiraApiToken: JiraApiToken;
}>;

export const JiraCloudAuth = Data.tagged<JiraCloudAuth>('JiraCloudAuth');

export type JiraDataCenterAuth = Data.Data<{
  _tag: 'JiraDataCenterAuth';
  jiraPat: JiraPat;
}>;

export const JiraDataCenterAuth =
  Data.tagged<JiraDataCenterAuth>('JiraDataCenterAuth');

export type JiraAuth = JiraCloudAuth | JiraDataCenterAuth;

export type AppConfig = {
  jiraApiUrl: JiraApiUrl;
  defaultJiraKeyPrefix: Option.Option<JiraKeyPrefix>;
  jiraAuth: JiraAuth;
};

export const JiraIssuetypeSchema = Schema.struct({
  name: Schema.string,
});

export type JiraIssuetype = Schema.Schema.To<typeof JiraIssuetypeSchema>;

export const JiraIssueSchema = Schema.struct({
  key: Schema.string,
  fields: Schema.struct({
    summary: Schema.string,
    issuetype: JiraIssuetypeSchema,
  }),
});

export type GitCreateJiraBranchResult =
  | CreatedBranch
  | SwitchedBranch
  | ResetBranch;

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

export interface CreatedBranch extends Data.Case {
  readonly _tag: 'CreatedBranch';
  readonly branch: string;
}

export const CreatedBranch = (branch: string): CreatedBranch =>
  Data.tagged<CreatedBranch>('CreatedBranch')({branch});

export interface SwitchedBranch extends Data.Case {
  readonly _tag: 'SwitchedBranch';
  readonly branch: string;
}

export const SwitchedBranch = (branch: string): SwitchedBranch =>
  Data.tagged<SwitchedBranch>('SwitchedBranch')({branch});

export interface ResetBranch extends Data.Case {
  readonly _tag: 'ResetBranch';
  readonly branch: string;
}

export const ResetBranch = (branch: string): ResetBranch =>
  Data.tagged<ResetBranch>('ResetBranch')({branch});

export type JiraIssue = Schema.Schema.To<typeof JiraIssueSchema>;

export type GitCreateJiraBranchError =
  | AppConfigError
  | GitExecError
  | JiraApiError;

export declare namespace GitCreateJiraBranchError {
  export interface Proto {
    readonly _tag: string;
    readonly message: string;
  }

  export type ProvidedFields = '_tag';
}

const makeError =
  <E extends GitCreateJiraBranchError.Proto>(tag: E['_tag']) =>
  (args: Omit<E, GitCreateJiraBranchError.ProvidedFields>): E =>
    Data.struct({
      _tag: tag,
      ...args,
    } as E);

export interface GitExecError extends GitCreateJiraBranchError.Proto {
  readonly _tag: 'GitExecError';
}

export const GitExecError = makeError<GitExecError>('GitExecError');

export interface AppConfigError extends GitCreateJiraBranchError.Proto {
  readonly _tag: 'AppConfigError';
}
export const AppConfigError = makeError<AppConfigError>('AppConfigError');

export interface JiraApiError extends GitCreateJiraBranchError.Proto {
  readonly _tag: 'JiraApiError';
}
export const JiraApiError = makeError<JiraApiError>('JiraApiError');
