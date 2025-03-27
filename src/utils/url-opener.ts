import * as ShellCommand from '@effect/platform/Command';
import type * as CommandExecutor from '@effect/platform/CommandExecutor';
import {Effect, Option, pipe} from 'effect';
import {UsageError} from '../types';

export const openUrl = (
  url: string,
): Effect.Effect<void, UsageError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const platform = yield* getPlatform();
    const command = getCommand(platform);

    return yield* Option.match(command, {
      onNone: () =>
        Effect.fail(UsageError({message: `Unsupported platform: ${platform}`})),
      onSome: (command) => openCommand(command, url),
    });
  });

const getPlatform = (): Effect.Effect<NodeJS.Platform> =>
  Effect.succeed(process.platform);

const getCommand = (platform: NodeJS.Platform): Option.Option<string> => {
  const commands: Partial<Record<NodeJS.Platform, string>> = {
    darwin: 'open',
    linux: 'xdg-open',
    // win32: 'start', /* TODO: Implement opening for Windows */
  };
  return Option.fromNullable(commands[platform]);
};

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
