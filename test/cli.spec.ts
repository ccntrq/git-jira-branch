import { Effect, Layer, pipe, Option } from "effect";
import { log } from "effect/Console";

import { Environment } from "../src/environment";
import { GitClient } from "../src/git-client";
import { JiraClient } from "../src/jira-client";
import { cliEffect } from "../src/cli";
import { gitCreateJiraBranch } from "../src/core";

import { vi, describe, afterEach, expect, beforeEach } from "vitest";
import { itEffect, toEffectMock } from "./util";

const mockGitClient = {
  createGitBranch: vi.fn(),
  createGitBranchFrom: vi.fn(),
};
const mockEnvironment = { getEnv: vi.fn() };
const mockJiraClient = { getJiraIssue: vi.fn() };

const testLayer = Layer.mergeAll(
  Layer.succeed(GitClient, GitClient.of(mockGitClient)),
  Layer.succeed(Environment, Environment.of(mockEnvironment)),
  Layer.succeed(JiraClient, JiraClient.of(mockJiraClient))
);

vi.mock("../src/core")

vi.mock("effect/Console");

const mockGitCreateJiraBranch = toEffectMock(gitCreateJiraBranch as any);
const mockLog = toEffectMock(log as any);

describe("cli", () => {
  describe("cliEffect", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      mockLog.mockSuccessValue(undefined);
      mockGitCreateJiraBranch.mockSuccessValue("XXX/NO-BRANCH");
    });

    itEffect("should create branch with single argument", () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          "feat/FOOX-1234-description"
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ["FOOX-1234"]),
              Effect.flatMap(cliEffect)
            ),
            testLayer
          )
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          "FOOX-1234",
          Option.none()
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      })
    );

    itEffect("should handle basebranch argument (-b)", () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          "feat/FOOX-1234-description"
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ["FOOX-1234", "-b", "master"]),
              Effect.flatMap(cliEffect)
            ),
            testLayer
          )
        );

        expect(mockGitCreateJiraBranch).toHaveBeenCalledWith(
          "FOOX-1234",
          Option.some("master")
        );
        expect(mockLog.mock.calls).toMatchSnapshot();
      })
    );

    itEffect("should report missing jirakey", () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          "feat/FOOX-1234-description"
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => []),
              Effect.flatMap(cliEffect)
            ),
            testLayer
          )
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls).toMatchSnapshot();
      })
    );

    itEffect("should print help (--help)", () =>
      Effect.gen(function* ($) {
        mockGitCreateJiraBranch.mockSuccessValue(
          "feat/FOOX-1234-description"
        );
        yield* $(
          Effect.provide(
            pipe(
              Effect.sync(() => ["--help"]),
              Effect.flatMap(cliEffect)
            ),
            testLayer
          )
        );

        expect(mockGitCreateJiraBranch).not.toHaveBeenCalled();
        expect(mockLog.mock.calls).toMatchSnapshot();
      })
    );
  });
});
