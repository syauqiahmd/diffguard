import type { GitAnalysis } from '../../types/index.js';

export function checkBranchStatus(analysis: GitAnalysis): string[] {
  const warnings: string[] = [];

  if (analysis.changedFiles.length === 0) {
    warnings.push(
      `No changes detected between '${analysis.currentBranch}' and 'origin/${analysis.targetBranch}'. ` +
        `Make sure you have commits that aren't in the target branch.`
    );
  }

  if (analysis.isBehind && analysis.commitsBehind > 5) {
    warnings.push(
      `Your branch is ${analysis.commitsBehind} commits behind 'origin/${analysis.targetBranch}'. ` +
        `Consider rebasing or merging to reduce potential conflicts and ensure the review is accurate.`
    );
  } else if (analysis.isBehind) {
    warnings.push(
      `Your branch is ${analysis.commitsBehind} commit${analysis.commitsBehind === 1 ? '' : 's'} behind ` +
        `'origin/${analysis.targetBranch}'.`
    );
  }

  if (analysis.changedFiles.length > 50) {
    warnings.push(
      `Large diff detected: ${analysis.changedFiles.length} files changed. ` +
        `Consider splitting into smaller PRs for better reviewability.`
    );
  }

  const deletedCount = analysis.changedFiles.filter((f) => f.status === 'deleted').length;
  if (deletedCount > 10) {
    warnings.push(
      `${deletedCount} files deleted. Verify these deletions are intentional.`
    );
  }

  return warnings;
}
