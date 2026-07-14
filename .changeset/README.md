# Changesets

Add a changeset to every pull request that should produce a new npm release:

```bash
pnpm changeset
```

Select the SemVer bump and write the changelog entry for users of the CLI. Keep
the entry concise, explain the observable result, and avoid commit prefixes or
implementation-only details. Commit the generated Markdown file with the code.

Changes that do not affect the published package do not need a changeset.
