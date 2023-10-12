import { exec } from "child_process";
import { Context, Effect, Layer } from "effect";
import { GitExecError } from "./types";

type GitClientEffect<A> = Effect.Effect<never, GitExecError, A>;

export interface GitClient {
  readonly createGitBranch: (branchName: string) => GitClientEffect<void>;
  readonly createGitBranchFrom: (
    baseBranch: string
  ) => (branchName: string) => GitClientEffect<void>;
}

export const GitClient = Context.Tag<GitClient>();

const createGitBranchFrom =
  (baseBranch: string) =>
  (branchName: string): GitClientEffect<void> =>
    Effect.async((cb) => {
      exec(`git checkout -b ${branchName} ${baseBranch}`, (err) =>
        err !== null
          ? cb(
              Effect.fail(
                GitExecError({
                  message: `Checkout failed:\n'${err.message.trim()}'`,
                })
              )
            )
          : cb(Effect.succeed(undefined))
      );
    });

const gitClient = {
  createGitBranchFrom: createGitBranchFrom,
  createGitBranch: createGitBranchFrom(""),
};

export const GitClientLive = Layer.succeed(GitClient, GitClient.of(gitClient));
