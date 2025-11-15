/**
 * Orchestrator Service Index
 *
 * Central export point for all orchestrator-related services, types, and templates.
 */

// Main service
export {
  OrchestratorService,
  orchestratorService,
  OrchestratorServiceError,
} from './orchestrator.service';

// Types
export {
  StepAction,
  FlowDefinition,
  FlowStep,
  FlowStepResult,
  FlowExecutionResult,
  FlowStatus,
  FlowError,
  FlowStreamUpdate,
  StepContext,
  StepInputSource,
  ContextPolicy,
  ExecutionOptions,
  StepExecutionInput,
  FlowListOptions,
  ParallelExecutionResult,
  ConditionalBranch,
  RefinementConfig,
  CritiqueConfig,
  ComparisonConfig,
  TimeoutConfig,
  ProviderSelectionStrategy,
} from './orchestrator.types';

// Templates
export {
  flowTemplates,
  getFlowTemplate,
  listFlowTemplates,
  createCritiqueFlow,
  createComparisonFlow,
  createRefinementFlow,
  createSequentialAnalysisFlow,
  createConditionalRoutingFlow,
  createConsensusFlow,
  createQualityAssuranceFlow,
} from './flow-templates';

// Re-export entity types for convenience
export {
  OrchestrationFlow,
  OrchestrationFlowType,
  OrchestrationFlowStatus,
} from '../entities/OrchestrationFlow';

export {
  OrchestrationStepResult,
  OrchestrationStepStatus,
} from '../entities/OrchestrationStepResult';
