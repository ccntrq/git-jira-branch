import type {JiraIssue} from '../types';

import {Doc} from '@effect/printer';
import {bold, underlined} from '@effect/printer-ansi/Ansi';
import {render} from '@effect/printer-ansi/AnsiDoc';
import {pipe} from 'effect';

export const formatIssue = (issue: JiraIssue): string => {
  const heading = pipe(
    [
      mkBold(Doc.text(issue.key)),
      pipe(
        [Doc.char('-'), Doc.reflow(issue.fields.summary)],
        unwords,
        Doc.hang(2),
      ),
    ],
    Doc.seps,
    Doc.hang(2),
    underline,
  );

  const details = pipe(
    [
      mkBold(Doc.text(issue.fields.issuetype.name)),
      unwords([
        Doc.char('|'),
        mkBold(Doc.text('Status:')),
        Doc.text(issue.fields.status.name),
      ]),
      unwords([
        Doc.char('|'),
        mkBold(Doc.text('Creator:')),
        Doc.text(issue.fields.creator.displayName),
      ]),
      issue.fields.assignee
        ? unwords([
            Doc.char('|'),
            mkBold(Doc.text('Assignee:')),
            Doc.text(issue.fields.assignee.displayName),
          ])
        : Doc.empty,
    ],
    Doc.seps,
    Doc.hang(2),
    underline,
  );

  const description = issue.fields.description
    ? pipe(
        issue.fields.description.split(/\n|\r\n/),
        (lines) => lines.map((l) => Doc.reflow(l)),
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

  return render(doc, {style: 'pretty', options: {lineWidth: 80}});
};

const unwords = <T>(docs: Iterable<Doc.Doc<T>>): Doc.Doc<T> =>
  Doc.concatWith<T>(Doc.catWithSpace)(docs);
const unlines = <T>(docs: Iterable<Doc.Doc<T>>): Doc.Doc<T> =>
  Doc.concatWith<T>(Doc.catWithLine)(docs);
const mkBold = Doc.annotate(bold);
const underline = Doc.annotate(underlined);
