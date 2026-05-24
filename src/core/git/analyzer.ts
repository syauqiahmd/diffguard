import simpleGit from 'simple-git';
import type { ChangedFile, GitAnalysis } from '../../types/index.js';

const git = simpleGit(process.cwd());

export async function detectDefaultBranch(): Promise<string> {
  try {
    const ref = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const branch = ref.trim().split('/').pop();
    if (branch) return branch;
  } catch {}

  for (const candidate of ['main', 'master']) {
    try {
      await git.raw(['rev-parse', '--verify', `origin/${candidate}`]);
      return candidate;
    } catch {}
  }

  return 'main';
}

export async function fetchRemoteBranch(target: string, source?: string): Promise<void> {
  try {
    await git.fetch('origin', target);
    if (source) await git.fetch('origin', source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch remote branch: ${message}`);
  }
}

export async function getCurrentBranch(): Promise<string> {
  try {
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const name = branch.trim();
    if (name === 'HEAD') {
      // Detached HEAD state — use short SHA as display name
      const sha = await git.revparse(['--short', 'HEAD']);
      return `detached@${sha.trim()}`;
    }
    return name;
  } catch {
    return 'unknown';
  }
}

export async function getCommitsBehind(targetBranch: string, sourceBranch?: string): Promise<number> {
  // source ref: remote branch if specified, otherwise local HEAD
  const sourceRef = sourceBranch ? `origin/${sourceBranch}` : 'HEAD';
  try {
    const result = await git.raw([
      'rev-list', '--count', `${sourceRef}..origin/${targetBranch}`,
    ]);
    return parseInt(result.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function parseGitDiffOutput(diffOutput: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const sections = diffOutput.split(/^(?=diff --git )/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const firstLine = lines[0] ?? '';
    const diffMatch = firstLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!diffMatch) continue;

    const filePath = diffMatch[2] ?? diffMatch[1] ?? '';
    let status: ChangedFile['status'] = 'modified';

    for (const line of lines.slice(1, 6)) {
      if (line.startsWith('new file mode')) { status = 'added'; break; }
      if (line.startsWith('deleted file mode')) { status = 'deleted'; break; }
      if (line.startsWith('rename ')) { status = 'renamed'; break; }
    }

    files.push({ path: filePath, status, diff: section });
  }

  return files;
}

export async function getChangedFiles(targetBranch: string, sourceBranch?: string): Promise<ChangedFile[]> {
  // source ref: remote branch if specified, otherwise local HEAD
  const sourceRef = sourceBranch ? `origin/${sourceBranch}` : 'HEAD';
  try {
    const diffOutput = await git.raw([
      'diff',
      `origin/${targetBranch}...${sourceRef}`,
      '--diff-algorithm=histogram',
    ]);
    if (!diffOutput.trim()) return [];
    return parseGitDiffOutput(diffOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get changed files: ${message}`);
  }
}

export async function getHeadSha(): Promise<string> {
  return (await git.revparse(['HEAD'])).trim();
}

export async function isShaReachable(sha: string): Promise<boolean> {
  try {
    await git.raw(['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

export async function getChangedFilesSince(sinceSha: string): Promise<ChangedFile[]> {
  try {
    const diffOutput = await git.raw([
      'diff',
      sinceSha,
      'HEAD',
      '--diff-algorithm=histogram',
    ]);
    if (!diffOutput.trim()) return [];
    return parseGitDiffOutput(diffOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get incremental diff: ${message}`);
  }
}

export async function analyzeGit(targetBranch: string, sourceBranch?: string): Promise<GitAnalysis> {
  // Display name: provided branch name or local branch name
  const currentBranch = sourceBranch ?? await getCurrentBranch();

  const [changedFiles, commitsBehind] = await Promise.all([
    getChangedFiles(targetBranch, sourceBranch),
    getCommitsBehind(targetBranch, sourceBranch),
  ]);

  return { targetBranch, currentBranch, changedFiles, commitsBehind, isBehind: commitsBehind > 0 };
}
