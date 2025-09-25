import {
  type DeletedBranch,
  matchGitCreateJiraBranchResult,
  type SwitchedBranch,
} from '../types.js';

export const formatSwitchedBranch = (switchedBranch: SwitchedBranch): string =>
  `Switched to already existing branch: '${switchedBranch.branch}'`;

export const formatDeletedBranch = (deletedBranch: DeletedBranch): string =>
  `Deleted branch: '${deletedBranch.branch}'`;

export const formatGitCreateJiraBranchResult = matchGitCreateJiraBranchResult({
  onCreatedBranch: ({branch}) => `Successfully created branch: '${branch}'`,
  onSwitchedBranch: formatSwitchedBranch,
  onDeletedBranch: formatDeletedBranch,
  onResetBranch: ({branch}) => `Reset branch: '${branch}'`,
});
