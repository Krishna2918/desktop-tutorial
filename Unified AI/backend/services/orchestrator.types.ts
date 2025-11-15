/**
 * Orchestrator Service Types
 *
 * Type definitions for multi-AI orchestration flows where AIs can collaborate
 * and communicate with each other to solve complex tasks.
 */

import { MessageRole } from '../entities/Message';
import { OrchestrationFlowType, OrchestrationFlowStatus } from '../entities/OrchestrationFlow';
import { OrchestrationStepStatus } from '../entities/OrchestrationStepResult';
import { TokenUsage } from '../adapters/base/AIProviderAdapter.interface';

/**
 * Step Actions - What the AI should do
 */
export enum StepAction {
  GENERATE = 'generate',      // Generate new content
  CRITIQUE = 'critique',       // Critique previous output
  REFINE = 'refine',          // Refine previous output
  SUMMARIZE = 'summarize',    // Summarize content
  ANALYZE = 'analyze',        // Analyze content
  COMPARE = 'compare',        // Compare multiple outputs
  EVALUATE = 'evaluate',      // Evaluate quality/accuracy
  VALIDATE = 'validate',      // Validate correctness
  EXTRACT = 'extract',        // Extract information
  TRANSFORM = 'transform'     // Transform format/style
}

/**
 * Step Input Source - Where the step gets its input
 */
export type StepInputSource =
  | 'previous'                  // From previous step
  | 'original'                  // From original user prompt
  | 'all'                       // From all previous steps
  | string;                     // From specific step by ID

/**
 * Flow Step Definition
 */
export interface FlowStep {
  id: string;
  provider: string;             // Provider key (e.g., 'openai', 'anthropic')
  model: string;                // Model name (e.g., 'gpt-4', 'claude-3-opus')
  action: StepAction;
  prompt: string | ((input: StepContext) => string | Promise<string>);
  inputFrom?: StepInputSource;
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
    [key: string]: any;
  };
  retryOnFailure?: boolean;
  maxRetries?: number;
  condition?: (context: StepContext) => boolean | Promise<boolean>;
  timeout?: number;             // Timeout in milliseconds
}

/**
 * Context Policy - Controls what context is shared between steps
 */
export interface ContextPolicy {
  shareConversationHistory: boolean;  // Share full thread history
  shareStepOutputs: boolean;          // Share previous step outputs
  maxSharedTokens: number;            // Maximum tokens to share
  includeOriginalPrompt: boolean;     // Always include original prompt
  preserveSystemPrompts: boolean;     // Preserve system prompts
}

/**
 * Flow Definition - Complete flow structure
 */
export interface FlowDefinition {
  name: string;
  description?: string;
  type: OrchestrationFlowType;
  steps: FlowStep[];
  contextPolicy?: Partial<ContextPolicy>;
  maxExecutionTime?: number;          // Maximum execution time in ms
  onStepComplete?: (step: FlowStepResult) => void | Promise<void>;
  onFlowComplete?: (result: FlowExecutionResult) => void | Promise<void>;
  onError?: (error: FlowError) => void | Promise<void>;
}

/**
 * Step Context - Available context for each step
 */
export interface StepContext {
  flowId: string;
  stepId: string;
  stepIndex: number;
  originalPrompt: string;
  previousStepOutput?: string;
  previousStepOutputs: Record<string, string>;  // stepId -> output
  allStepResults: FlowStepResult[];
  threadHistory: any[];                         // Full conversation history
  metadata: Record<string, any>;
}

/**
 * Step Result - Result of executing a single step
 */
export interface FlowStepResult {
  stepId: string;
  stepIndex: number;
  provider: string;
  model: string;
  action: StepAction;
  status: OrchestrationStepStatus;
  output?: string;
  error?: string;
  usage?: TokenUsage;
  cost?: number;
  executionTime: number;        // Milliseconds
  retryCount: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Flow Execution Result - Complete flow result
 */
export interface FlowExecutionResult {
  flowId: string;
  flowType: OrchestrationFlowType;
  status: OrchestrationFlowStatus;
  steps: FlowStepResult[];
  finalOutput?: string;
  totalCost: number;
  totalTokens: number;
  totalExecutionTime: number;   // Milliseconds
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Flow Status - Current status of a running flow
 */
export interface FlowStatus {
  flowId: string;
  status: OrchestrationFlowStatus;
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  progress: number;              // 0-100
  startedAt?: Date;
  estimatedTimeRemaining?: number; // Milliseconds
}

/**
 * Flow Error
 */
export interface FlowError {
  flowId: string;
  stepId?: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * Streaming Update - Real-time updates during flow execution
 */
export interface FlowStreamUpdate {
  type: 'step_start' | 'step_progress' | 'step_complete' | 'flow_complete' | 'error';
  flowId: string;
  stepId?: string;
  data?: any;
  timestamp: Date;
}

/**
 * Conditional Branch
 */
export interface ConditionalBranch {
  condition: (context: StepContext) => boolean | Promise<boolean>;
  steps: FlowStep[];
}

/**
 * Refinement Loop Configuration
 */
export interface RefinementConfig {
  maxIterations: number;
  convergenceCriteria?: (iteration: number, context: StepContext) => boolean | Promise<boolean>;
  improvementThreshold?: number;  // Minimum improvement score to continue
}

/**
 * Critique Configuration
 */
export interface CritiqueConfig {
  criteriaPrompt: string;
  passingScore?: number;
  maxRefinementRounds?: number;
}

/**
 * Comparison Configuration
 */
export interface ComparisonConfig {
  providers: Array<{
    provider: string;
    model: string;
  }>;
  evaluationCriteria: string[];
  selectBest?: boolean;
}

/**
 * Provider Timeout Configuration
 */
export interface TimeoutConfig {
  stepTimeout: number;          // Per-step timeout in ms
  flowTimeout: number;          // Total flow timeout in ms
  retryDelay: number;           // Delay between retries in ms
}

/**
 * Execution Options
 */
export interface ExecutionOptions {
  streaming?: boolean;
  onUpdate?: (update: FlowStreamUpdate) => void;
  userId: string;
  threadId?: string;
  saveMessages?: boolean;       // Save step results as messages
  timeout?: TimeoutConfig;
  metadata?: Record<string, any>;
}

/**
 * Step Execution Input
 */
export interface StepExecutionInput {
  flowId: string;
  stepId: string;
  input?: string;
  context?: Partial<StepContext>;
  override?: Partial<FlowStep>;
}

/**
 * Flow List Options
 */
export interface FlowListOptions {
  status?: OrchestrationFlowStatus;
  type?: OrchestrationFlowType;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'completedAt' | 'name';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Provider Selection Strategy
 */
export enum ProviderSelectionStrategy {
  ROUND_ROBIN = 'round_robin',
  COST_OPTIMIZED = 'cost_optimized',
  QUALITY_OPTIMIZED = 'quality_optimized',
  SPEED_OPTIMIZED = 'speed_optimized',
  CUSTOM = 'custom'
}

/**
 * Parallel Execution Result
 */
export interface ParallelExecutionResult {
  results: FlowStepResult[];
  consensus?: string;
  bestResult?: FlowStepResult;
  aggregatedOutput?: string;
}
