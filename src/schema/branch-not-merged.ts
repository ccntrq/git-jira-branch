import {Schema} from '@effect/schema';

export class BranchNotMerged extends Schema.TaggedError<BranchNotMerged>()(
  'BranchNotMerged',
  {
    branch: Schema.String,
    originalMessage: Schema.String,
  },
) {}
