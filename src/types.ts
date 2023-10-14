import * as Schema from "@effect/schema/Schema";
import { Brand, Data } from "effect";

export type JiraApiUrl = string & Brand.Brand<"JiraApiUrl">;
export const JiraApiUrl = Brand.nominal<JiraApiUrl>();
export type JiraPat = string & Brand.Brand<"JiraPat">;
export const JiraPat = Brand.nominal<JiraPat>();
export type JiraKeyPrefix = string & Brand.Brand<"JiraKeyPrefix">;
export const JiraKeyPrefix = Brand.nominal<JiraKeyPrefix>();

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

  export type ProvidedFields = "_tag";
}

const makeError =
  <E extends GitCreateJiraBranchError.Proto>(tag: E["_tag"]) =>
  (args: Omit<E, GitCreateJiraBranchError.ProvidedFields>): E =>
    Data.struct({
      _tag: tag,
      ...args,
    } as E);

export interface GitExecError extends GitCreateJiraBranchError.Proto {
  readonly _tag: "GitExecError";
}

export const GitExecError = makeError<GitExecError>("GitExecError");

export interface AppConfigError extends GitCreateJiraBranchError.Proto {
  readonly _tag: "AppConfigError";
}
export const AppConfigError = makeError<AppConfigError>("AppConfigError");

export interface JiraApiError extends GitCreateJiraBranchError.Proto {
  readonly _tag: "JiraApiError";
}
export const JiraApiError = makeError<JiraApiError>("JiraApiError");
