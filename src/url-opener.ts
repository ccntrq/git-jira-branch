import {Effect, pipe} from 'effect';
import {UsageError} from './types';
import * as ShellCommand from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';

export const openUrl = (
  url: string,
): Effect.Effect<void, UsageError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* ($) {
    const platform = yield* $(getPlatform());

    if (platform === 'linux') {
      return yield* $(xdgOpen(url));
    }

    // TODO: add support for opening urls on other platforms
    return yield* $(
      Effect.fail(
        UsageError({
          message: `Opening urls on ${platform} is not yet supported.`,
        }),
      ),
    );
  });

const getPlatform = (): Effect.Effect<NodeJS.Platform> =>
  Effect.succeed(process.platform);

const xdgOpen = (
  url: string,
): Effect.Effect<void, UsageError, CommandExecutor.CommandExecutor> =>
  pipe(
    ShellCommand.make('xdg-open', url),
    ShellCommand.exitCode,
    Effect.mapError(() =>
      UsageError({message: 'Browser could not be opened.'}),
    ),
    Effect.map(() => void 0),
  );
