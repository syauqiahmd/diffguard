import simpleGit from 'simple-git';
import type { ChangedFile, GitAnalysis } from '../../types/index.js';

const git = simpleGit(process.cwd());

export async function fetchRemoteBranch(target: string): Promise<void> {
  try {
    await git.fetch('origin', target);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch remote branch 'origin/${target}': ${message}`);
  }
}

export async function getCurrentBranch(): Promise<string> {
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
  return branch.trim();
}

export async function getCommitsBehind(targetBranch: string): Promise<number> {
  try {
    const result = await git.raw([
      'rev-list',
      '--count',
      `HEAD..origin/${targetBranch}`,
    ]);
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function parseGitDiffOutput(diffOutput: string): ChangedFile[] {
  const files: ChangedFile[] = [];

  // Split by "diff --git" to get per-file sections
  const sections = diffOutput.split(/^(?=diff --git )/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const firstLine = lines[0] ?? '';

    // Extract file path from "diff --git a/path b/path"
    const diffMatch = firstLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!diffMatch) continue;

    const filePath = diffMatch[2] ?? diffMatch[1] ?? '';

    // Determine status from index/rename/new/deleted markers
    let status: ChangedFile['status'] = 'modified';

    for (const line of lines.slice(1, 6)) {
      if (line.startsWith('new file mode')) {
        status = 'added';
        break;
      }
      if (line.startsWith('deleted file mode')) {
        status = 'deleted';
        break;
      }
      if (line.startsWith('rename ')) {
        status = 'renamed';
        break;
      }
    }

    files.push({
      path: filePath,
      status,
      diff: section,
    });
  }

  return files;
}

export async function getChangedFiles(targetBranch: string): Promise<ChangedFile[]> {
  try {
    // Get the diff between current HEAD and origin/targetBranch
    const diffOutput = await git.raw([
      'diff',
      `origin/${targetBranch}...HEAD`,
      '--diff-algorithm=histogram',
    ]);

    if (!diffOutput.trim()) {
      return [];
    }

    return parseGitDiffOutput(diffOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get changed files: ${message}`);
  }
}

export async function analyzeGit(targetBranch: string): Promise<GitAnalysis> {
  const [currentBranch, changedFiles, commitsBehind] = await Promise.all([
    getCurrentBranch(),
    getChangedFiles(targetBranch),
    getCommitsBehind(targetBranch),
  ]);

  return {
    targetBranch,
    currentBranch,
    changedFiles,
    commitsBehind,
    isBehind: commitsBehind > 0,
  };
}
