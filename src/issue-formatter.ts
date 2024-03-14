import type {JiraIssue} from './types';

import {Doc} from '@effect/printer';
import {bold, underlined} from '@effect/printer-ansi/Ansi';
import {render} from '@effect/printer-ansi/AnsiDoc';
import {pipe} from 'effect';

export const formatIssue = (issue: JiraIssue): string => {
  const heading = pipe(
    [
      mkBold(Doc.text(issue.key)),
      //Doc.text(issue.key),
      Doc.char('-'),
      Doc.text(issue.fields.summary),
    ],
    unwords,
    underline,
  );

  const details = pipe(
    [
      mkBold(Doc.text(issue.fields.issuetype.name)),
      Doc.char('|'),
      mkBold(Doc.text('Status:')),
      Doc.text(issue.fields.status.name),
      Doc.char('|'),
      mkBold(Doc.text('Creator:')),
      Doc.text(issue.fields.creator.displayName),
      ...(issue.fields.assignee
        ? [
            Doc.char('|'),
            mkBold(Doc.text('Assignee:')),
            Doc.text(issue.fields.assignee.displayName),
          ]
        : []),
    ],
    unwords,
    underline,
  );

  const description = issue.fields.description
    ? pipe(
        issue.fields.description.split(/\n|\r\n/),
        (d) =>
          // TODO:
          // use fillSep/reflow here to break lines at 80 characters when
          // performance issue is resolved
          // https://github.com/Effect-TS/effect/issues/2371
          // https://discord.com/channels/795981131316985866/1219736390401786008
          d.map(Doc.text),
        Doc.vcat,
      )
    : Doc.empty;

  const doc = pipe(
    [
      heading,
      details,
      ...(Doc.isEmpty(description) ? [] : [Doc.empty, description]),
    ],
    unlines,
  );

  return render(doc, {style: 'pretty'});
};

const unwords = <T>(docs: Iterable<Doc.Doc<T>>): Doc.Doc<T> =>
  Doc.concatWith<T>(Doc.catWithSpace)(docs);
const unlines = <T>(docs: Iterable<Doc.Doc<T>>): Doc.Doc<T> =>
  Doc.concatWith<T>(Doc.catWithLine)(docs);
const mkBold = Doc.annotate(bold);
const underline = Doc.annotate(underlined);
