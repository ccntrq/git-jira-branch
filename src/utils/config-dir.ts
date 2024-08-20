import os from 'node:os';
import path from 'node:path';
import {Effect, Match} from 'effect';

const homeDir = Effect.sync(() => os.homedir());
const getPlatform = Effect.sync(() => process.platform);

export const configDir: Effect.Effect<string> = Effect.gen(function* () {
  const plat = yield* getPlatform;
  const dir = Match.value(plat).pipe(
    Match.when('win32', () => ['AppData', 'Roaming']),
    Match.when('darwin', () => ['Library', 'Application Support']),
    Match.orElse(() => ['.config']),
  );

  return yield* Effect.map(homeDir, (h) => path.join(h, ...dir));
});
