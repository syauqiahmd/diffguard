export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff: string;
}

export interface GitAnalysis {
  targetBranch: string;
  currentBranch: string;
  changedFiles: ChangedFile[];
  commitsBehind: number;
  isBehind: boolean;
}

export interface RuleViolation {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
}

export interface ContextFile {
  path: string;
  content: string;
  reason: string;
  tokenEstimate: number;
}

export interface ReviewContext {
  changedFiles: ChangedFile[];
  relatedFiles: ContextFile[];
  ruleViolations: RuleViolation[];
  totalTokens: number;
  estimatedCost: number;
}

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
  provider: string;
}

export interface SuppressRule {
  file?: string;      // substring match on file path
  line?: number;      // specific line number
  contains?: string;  // substring match on finding note text
  tag?: string;       // impact tag to suppress (api-break, data-loss, etc.)
}

export interface DiffguardConfig {
  version: number;
  review: {
    mode: 'fast' | 'balanced' | 'deep';
    provider?: string;
    model?: string;
    incremental?: boolean;
  };
  rules: {
    max_complexity?: number;
    forbidden?: string[];
    required?: string[];
  };
  architecture?: {
    no_direct_db_access?: boolean;
    controller_must_not_contain_business_logic?: boolean;
  };
  ignore?: string[];
  suppress?: SuppressRule[];
}

export interface UsageRecord {
  date: string;
  branch: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface AIProvider {
  name: string;
  complete(prompt: string, system: string, model?: string): Promise<AIResponse>;
  estimateTokens(text: string): number;
}
