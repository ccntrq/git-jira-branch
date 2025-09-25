import {Console, Effect, Option, pipe} from 'effect';
import {AppConfigService} from '../../services/app-config.js';
import type {GitClient} from '../../services/git-client.js';
import type {AppConfigError, GitJiraBranchError} from '../../types.js';
import {fullJiraKey} from '../../utils/jira-key.js';
import {jiraKeyFromCurrentBranch} from '../../utils/jira-key-from-branch.js';
import {openUrl} from '../../utils/url-opener.js';

export const openTicket = (jiraKey: Option.Option<string>) =>
  pipe(
    jiraKey,
    Option.match({
      onSome: (jiraKey) => ticketUrl(jiraKey),
      onNone: () => ticketUrlForCurrentBranch(),
    }),
    Effect.tap((url) =>
      Console.log(`Opening ticket url '${url}' in your default browser...`),
    ),
    Effect.flatMap(openUrl),
  );

export const ticketUrlForCurrentBranch = (): Effect.Effect<
  string,
  GitJiraBranchError,
  AppConfigService | GitClient
> => jiraKeyFromCurrentBranch().pipe(Effect.flatMap(ticketUrl));

export const ticketUrl = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  pipe(jiraKey, fullJiraKey, Effect.flatMap(buildTicketUrl));

const buildTicketUrl = (
  jiraKey: string,
): Effect.Effect<string, AppConfigError, AppConfigService> =>
  AppConfigService.pipe(
    Effect.flatMap((_) => _.getAppConfig),
    Effect.map(({jiraApiUrl}) => `${jiraApiUrl}/browse/${jiraKey}`),
  );
