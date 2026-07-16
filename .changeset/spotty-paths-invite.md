---
"git-jira-branch": minor
---

Want to continue work on you branches create on another machine or pick up work
from your colleagues?
The switch command now finds branches that only exist on a remote and checks
them out, matching `git switch` behavior: the local tracking branch is created
by git's own checkout guessing. The interactive ticket picker for switch also
offers remote-only branches, rendered with their remote prefix (e.g.
`origin/feat/...`).
