import {Schema} from '@effect/schema';

export class NoAssociatedBranch extends Schema.TaggedError<NoAssociatedBranch>()(
  'NoAssociatedBranch',
  {
    jiraKey: Schema.String,
  },
) {
  override get message() {
    return `No branch associated with Jira ticket '${this.jiraKey}'`;
  }
}
