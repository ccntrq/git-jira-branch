import path from 'node:path';
import {FileSystem} from '@effect/platform';
import {ArrayFormatter, Schema} from '@effect/schema';
import {
  Context,
  Array as EArray,
  Effect,
  Layer,
  Match,
  flow,
  pipe,
} from 'effect';
import {configDir} from '../utils/config-dir';

const defaultBranchtype = 'feat';
const issuetypeToBranchtype: Map<string, string> = new Map(
  Object.entries({
    bug: 'fix',
    task: 'task',
    aufgabe: 'task',
  }),
);

export class CustomizationsError extends Schema.TaggedError<CustomizationsError>()(
  'CustomizationsError',
  {
    message: Schema.String,
  },
) {}

export class Customizations extends Schema.Class<Customizations>(
  'Customizations',
)({
  defaultBranchtype: Schema.optionalWith(Schema.String, {
    default: () => defaultBranchtype,
  }),
  issuetypeToBranchtype: Schema.optionalWith(
    Schema.MapFromRecord({
      key: Schema.String,
      value: Schema.String,
    }),
    {default: () => issuetypeToBranchtype},
  ),
}) {}

const readCustomizationsFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const customizationsFile = yield* configDir.pipe(
    Effect.map((c) => path.join(c, 'git-jira-branch', 'customizations.json')),
  );

  return yield* pipe(
    customizationsFile,
    fs.readFileString,
    Effect.catchIf(
      (e) => e._tag === 'SystemError' && e.reason === 'NotFound',
      () => Effect.succeed(''),
    ),
    Effect.map((x) => x.trim()),
    Effect.map((x) => (x.length > 0 ? x : '{}')),
    Effect.flatMap(Schema.decode(Schema.parseJson(Customizations))),
    Effect.mapError(
      flow(
        Match.value,
        Match.tag('ParseError', (e) => {
          const errors = ArrayFormatter.formatErrorSync(e);
          const invalid = EArray.dedupe(errors.map((e) => e.path.join('.')));
          return new CustomizationsError({
            message: `Invalid customizations: [${invalid.map((e) => `'${e}'`).join(',')}]`,
          });
        }),
        Match.tag(
          'BadArgument',
          (e) =>
            new CustomizationsError({
              message: `Failed to load customizations from '${customizationsFile}. Error: ${e.message}'`,
            }),
        ),
        Match.tag(
          'SystemError',
          (e) =>
            new CustomizationsError({
              message: `Failed to load customizations from '${customizationsFile}. Error: ${e.message}'`,
            }),
        ),
        Match.exhaustive,
      ),
    ),
  );
});

// biome-ignore lint/complexity/noStaticOnlyClass: Okay for services
export class CustomizationsService extends Context.Tag('CusomizationsService')<
  CustomizationsService,
  {
    readonly customizations: Effect.Effect<Customizations, CustomizationsError>;
  }
>() {
  public static readonly Live = Layer.effect(
    CustomizationsService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      return CustomizationsService.of({
        customizations: readCustomizationsFile.pipe(
          Effect.provide(Layer.succeed(FileSystem.FileSystem, fs)),
        ),
      });
    }),
  );
}
