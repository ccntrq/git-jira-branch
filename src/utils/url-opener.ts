import * as ShellCommand from '@effect/platform/Command';
import type * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Effect, pipe} from 'effect';
import {UsageError} from '../types';

export const openUrl = (
  url: string,
): Effect.Effect<void, UsageError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const platform = yield* getPlatform();
    const command =
      platform === 'linux'
        ? 'xdg-open'
        : platform === 'darwin'
          ? 'open'
          : platform === 'win32'
            ? 'start'
            : null;

    if (!command) {
      return yield* Effect.fail(
        UsageError({message: `Unsupported platform: ${platform}`}),
      );
    }

    return yield* openCommand(command, url);
  });

const getPlatform = (): Effect.Effect<NodeJS.Platform> =>
  Effect.succeed(process.platform);

const openCommand = (
  command: string,
  url: string,
): Effect.Effect<void, UsageError, CommandExecutor.CommandExecutor> =>
  pipe(
    ShellCommand.make(command, url),
    ShellCommand.exitCode,
    Effect.mapError(() =>
      UsageError({message: 'Browser could not be opened.'}),
    ),
    Effect.map(() => void 0),
  );
