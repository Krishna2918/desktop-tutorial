# Orchestrator Service Documentation

## Overview

The **OrchestratorService** is a comprehensive multi-AI orchestration system that enables different AI providers to collaborate, communicate, and build upon each other's outputs. Think of it as a conductor that coordinates multiple AI "musicians" to create a harmonious solution.

## Key Features

- **Multi-AI Collaboration**: Different AIs can work together on complex tasks
- **5 Flow Types**: Sequential, Parallel, Conditional, Critique, and Refinement
- **Production-Ready**: Full error handling, retry logic, cancellation support
- **Data Privacy**: Respects DataSharingPolicy for each provider
- **Cost Tracking**: Monitors token usage and costs per step
- **Real-time Updates**: WebSocket streaming support for live progress
- **Pre-built Templates**: 7 ready-to-use flow templates
- **Persistent Storage**: All flows and results saved to database

## Flow Types

### 1. Sequential Flow
Steps execute one after another, with each step building on previous results.

**Use Cases:**
- Translation → Summarization → Sentiment Analysis
- Extract Facts → Analyze Logic → Evaluate Credibility
- Generate → Review → Publish

**Example:**
```typescript
const flow: FlowDefinition = {
  type: OrchestrationFlowType.SEQUENTIAL,
  steps: [
    { id: 'step1', provider: 'openai', model: 'gpt-4', action: 'generate', ... },
    { id: 'step2', provider: 'anthropic', model: 'claude-3-opus', action: 'critique', ... },
    { id: 'step3', provider: 'openai', model: 'gpt-4', action: 'refine', ... }
  ]
};
```

### 2. Parallel Flow
Multiple steps execute simultaneously, then results are aggregated.

**Use Cases:**
- Ask same question to GPT-4, Claude, and Gemini
- Multiple perspectives on a complex problem
- A/B testing different prompts

**Example:**
```typescript
const flow = createComparisonFlow([
  { provider: 'openai', model: 'gpt-4' },
  { provider: 'anthropic', model: 'claude-3-opus' },
  { provider: 'google', model: 'gemini-pro' }
]);
```

### 3. Conditional Flow
Steps execute based on conditions from previous results.

**Use Cases:**
- Route to expert AI based on complexity
- Different handling for different content types
- Adaptive workflows based on confidence scores

**Example:**
```typescript
{
  id: 'expert_step',
  condition: (context) => {
    const complexity = parseFloat(context.previousStepOutput);
    return complexity > 0.7;
  },
  ...
}
```

### 4. Critique Flow
One AI generates content, another AI critiques it, original AI refines.

**Use Cases:**
- Code generation with review
- Content creation with editorial feedback
- Scientific writing with peer review

**Example:**
```typescript
const flow = createCritiqueFlow('openai', 'gpt-4', 'anthropic', 'claude-3-opus');
```

### 5. Refinement Flow
Iterative improvement until quality threshold is met.

**Use Cases:**
- Content polishing until it passes quality checks
- Bug fixing iterations
- Progressive enhancement

**Example:**
```typescript
const flow = createRefinementFlow(
  5,     // Max 5 iterations
  0.85   // Quality threshold of 0.85
);
```

## Core API

### Flow Management

#### Create Flow
```typescript
const flow = await orchestratorService.createFlow(
  threadId: string,
  userId: string,
  flowDefinition: FlowDefinition
);
```

#### Get Flow
```typescript
const flow = await orchestratorService.getFlow(
  flowId: string,
  userId: string
);
```

#### List Flows
```typescript
const flows = await orchestratorService.listFlows(
  threadId: string,
  userId: string,
  options?: {
    status?: OrchestrationFlowStatus,
    type?: OrchestrationFlowType,
    limit?: number,
    offset?: number,
    sortBy?: 'createdAt' | 'completedAt' | 'name',
    sortOrder?: 'ASC' | 'DESC'
  }
);
```

#### Delete Flow
```typescript
await orchestratorService.deleteFlow(
  flowId: string,
  userId: string
);
```

### Flow Execution

#### Execute Flow
```typescript
const result = await orchestratorService.executeFlow(
  flowId: string,
  userId: string,
  options?: {
    streaming?: boolean,
    onUpdate?: (update: FlowStreamUpdate) => void,
    saveMessages?: boolean,
    timeout?: TimeoutConfig,
    metadata?: Record<string, any>
  }
);
```

#### Execute Single Step
```typescript
const stepResult = await orchestratorService.executeStep(
  flowId: string,
  stepId: string,
  userId: string,
  input?: string
);
```

#### Cancel Flow
```typescript
await orchestratorService.cancelFlow(
  flowId: string,
  userId: string
);
```

#### Get Flow Status
```typescript
const status = await orchestratorService.getFlowStatus(flowId: string);
// Returns: { flowId, status, progress, currentStepIndex, totalSteps, ... }
```

## Flow Definition Structure

```typescript
interface FlowDefinition {
  name: string;
  description?: string;
  type: OrchestrationFlowType;
  steps: FlowStep[];
  contextPolicy?: ContextPolicy;
  maxExecutionTime?: number;
  onStepComplete?: (step: FlowStepResult) => void;
  onFlowComplete?: (result: FlowExecutionResult) => void;
  onError?: (error: FlowError) => void;
}

interface FlowStep {
  id: string;
  provider: string;              // 'openai', 'anthropic', 'google', etc.
  model: string;                 // 'gpt-4', 'claude-3-opus', etc.
  action: StepAction;            // What this step does
  prompt: string | ((context: StepContext) => string | Promise<string>);
  inputFrom?: 'previous' | 'original' | 'all' | string;
  settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
  };
  retryOnFailure?: boolean;
  maxRetries?: number;
  condition?: (context: StepContext) => boolean | Promise<boolean>;
  timeout?: number;
}
```

## Step Actions

- `GENERATE` - Generate new content
- `CRITIQUE` - Critique previous output
- `REFINE` - Refine/improve previous output
- `SUMMARIZE` - Summarize content
- `ANALYZE` - Analyze content
- `COMPARE` - Compare multiple outputs
- `EVALUATE` - Evaluate quality/accuracy
- `VALIDATE` - Validate correctness
- `EXTRACT` - Extract information
- `TRANSFORM` - Transform format/style

## Context Policy

Control what context is shared between steps:

```typescript
interface ContextPolicy {
  shareConversationHistory: boolean;  // Share full thread history
  shareStepOutputs: boolean;          // Share previous step outputs
  maxSharedTokens: number;            // Max tokens to share (for cost control)
  includeOriginalPrompt: boolean;     // Always include user's original prompt
  preserveSystemPrompts: boolean;     // Preserve system prompts
}
```

**Default Policy:**
```typescript
{
  shareConversationHistory: false,
  shareStepOutputs: true,
  maxSharedTokens: 10000,
  includeOriginalPrompt: true,
  preserveSystemPrompts: false
}
```

## Pre-built Templates

### 1. Critique Flow
```typescript
import { createCritiqueFlow } from './flow-templates';

const flow = createCritiqueFlow(
  'openai',     // Generator provider
  'gpt-4',      // Generator model
  'anthropic',  // Critic provider
  'claude-3-opus-20240229'  // Critic model
);
```

### 2. Comparison Flow
```typescript
const flow = createComparisonFlow([
  { provider: 'openai', model: 'gpt-4' },
  { provider: 'anthropic', model: 'claude-3-opus' },
  { provider: 'google', model: 'gemini-pro' }
]);
```

### 3. Refinement Flow
```typescript
const flow = createRefinementFlow(
  5,     // Max iterations
  0.8    // Quality threshold (0.0 to 1.0)
);
```

### 4. Sequential Analysis Flow
```typescript
const flow = createSequentialAnalysisFlow();
// Extract facts → Analyze logic → Evaluate credibility → Synthesize
```

### 5. Conditional Routing Flow
```typescript
const flow = createConditionalRoutingFlow();
// Classify request → Route to specialized expert
```

### 6. Consensus Flow
```typescript
const flow = createConsensusFlow();
// Multiple AIs propose → Build consensus
```

### 7. Quality Assurance Flow
```typescript
const flow = createQualityAssuranceFlow();
// Generate → Check accuracy → Check clarity → Final verdict
```

## Usage Examples

### Example 1: Simple Critique Flow

```typescript
import { orchestratorService, createCritiqueFlow } from './orchestrator.index';

async function critiqueMyCode(threadId: string, userId: string) {
  // Create flow
  const flowDef = createCritiqueFlow();
  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  // Execute with streaming
  const result = await orchestratorService.executeFlow(flow.id, userId, {
    streaming: true,
    onUpdate: (update) => {
      console.log(`[${update.type}] ${update.stepId}:`, update.data);
    }
  });

  console.log('Final refined code:', result.finalOutput);
  console.log('Total cost:', `$${result.totalCost.toFixed(4)}`);
}
```

### Example 2: Custom Sequential Flow

```typescript
import { StepAction, OrchestrationFlowType } from './orchestrator.index';

const translationPipeline: FlowDefinition = {
  name: 'Translation Pipeline',
  type: OrchestrationFlowType.SEQUENTIAL,
  steps: [
    {
      id: 'translate',
      provider: 'openai',
      model: 'gpt-4',
      action: StepAction.TRANSFORM,
      prompt: (context) => `Translate to English: ${context.originalPrompt}`,
      settings: { temperature: 0.3 }
    },
    {
      id: 'summarize',
      provider: 'anthropic',
      model: 'claude-3-opus',
      action: StepAction.SUMMARIZE,
      prompt: (context) => `Summarize: ${context.previousStepOutput}`,
      inputFrom: 'translate',
      settings: { temperature: 0.5 }
    }
  ]
};
```

### Example 3: Conditional Expert Routing

```typescript
const smartRouting: FlowDefinition = {
  name: 'Smart Expert Routing',
  type: OrchestrationFlowType.CONDITIONAL,
  steps: [
    {
      id: 'classify',
      provider: 'openai',
      model: 'gpt-4',
      action: StepAction.ANALYZE,
      prompt: (ctx) => `Classify this as TECHNICAL/CREATIVE/ANALYTICAL: ${ctx.originalPrompt}`
    },
    {
      id: 'technical_expert',
      provider: 'openai',
      model: 'gpt-4',
      action: StepAction.GENERATE,
      prompt: 'original',
      condition: (ctx) => ctx.previousStepOutput?.includes('TECHNICAL'),
      settings: { temperature: 0.3 }
    },
    {
      id: 'creative_expert',
      provider: 'anthropic',
      model: 'claude-3-opus',
      action: StepAction.GENERATE,
      prompt: 'original',
      condition: (ctx) => ctx.previousStepOutput?.includes('CREATIVE'),
      settings: { temperature: 0.8 }
    }
  ]
};
```

### Example 4: Monitoring and Cancellation

```typescript
async function monitorFlow(flowId: string, userId: string) {
  // Start execution
  const executionPromise = orchestratorService.executeFlow(flowId, userId);

  // Monitor progress
  const interval = setInterval(async () => {
    const status = await orchestratorService.getFlowStatus(flowId);
    console.log(`Progress: ${status.progress.toFixed(1)}%`);

    // Cancel if taking too long
    if (status.startedAt) {
      const elapsed = Date.now() - status.startedAt.getTime();
      if (elapsed > 60000) {  // 1 minute
        await orchestratorService.cancelFlow(flowId, userId);
        clearInterval(interval);
      }
    }
  }, 2000);

  try {
    const result = await executionPromise;
    clearInterval(interval);
    return result;
  } catch (error) {
    clearInterval(interval);
    throw error;
  }
}
```

## Step Context

Each step receives rich context about the flow execution:

```typescript
interface StepContext {
  flowId: string;                               // Current flow ID
  stepId: string;                               // Current step ID
  stepIndex: number;                            // Step index (0-based)
  originalPrompt: string;                       // User's original prompt
  previousStepOutput?: string;                  // Previous step's output
  previousStepOutputs: Record<string, string>;  // All previous outputs by step ID
  allStepResults: FlowStepResult[];            // Complete history
  threadHistory: ConversationMessage[];         // Thread conversation history
  metadata: Record<string, any>;                // Custom metadata
}
```

## Error Handling

The orchestrator provides comprehensive error handling:

```typescript
// Retry logic per step
{
  id: 'resilient_step',
  retryOnFailure: true,
  maxRetries: 3,
  timeout: 30000,  // 30 seconds
  ...
}

// Flow-level error handling
try {
  const result = await orchestratorService.executeFlow(flowId, userId, {
    onUpdate: (update) => {
      if (update.type === 'error') {
        console.error('Step error:', update.data);
      }
    }
  });
} catch (error) {
  // Get detailed failure info
  const status = await orchestratorService.getFlowStatus(flowId);
  console.log('Failed at step:', status.currentStepIndex);
  console.log('Failed steps:', status.failedSteps);
}
```

## Data Privacy & Permissions

The orchestrator respects data sharing policies and permissions:

### Permission Checks
- Requires `write` permission to create flows
- Requires `read` permission to view flows
- Requires `delete` permission to delete flows
- Checks thread-level permissions

### Data Sharing Policy
- Checks `DataSharingPolicy` before sharing context
- Respects `allowConversationHistory` setting
- Respects `allowCrossProviderContext` setting
- Throws error if policy violation detected

```typescript
// User must have configured data sharing policy
const policy = {
  userId: 'user123',
  providerKey: 'openai',
  allowConversationHistory: true,
  allowCrossProviderContext: true,
  allowAttachments: true
};
```

## Cost Tracking

Every step tracks token usage and estimated cost:

```typescript
const result = await orchestratorService.executeFlow(flowId, userId);

console.log('Total cost:', `$${result.totalCost.toFixed(4)}`);
console.log('Total tokens:', result.totalTokens);

// Per-step costs
for (const step of result.steps) {
  console.log(`${step.stepId}: $${step.cost?.toFixed(4)} (${step.usage?.totalTokens} tokens)`);
}
```

## Database Schema

### OrchestrationFlow Entity
```typescript
{
  id: string;
  threadId: string;
  name: string;
  description?: string;
  flowType: OrchestrationFlowType;
  steps: FlowStep[];
  currentStepIndex: number;
  status: OrchestrationFlowStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: FlowExecutionResult;
}
```

### OrchestrationStepResult Entity
```typescript
{
  id: string;
  flowId: string;
  stepId: string;
  messageId?: string;
  status: OrchestrationStepStatus;
  output?: string;
  metadata?: {
    provider: string;
    model: string;
    action: StepAction;
    usage: TokenUsage;
    cost: number;
    retryCount: number;
  };
  executedAt: Date;
}
```

## Best Practices

### 1. Use Appropriate Flow Types
- **Sequential** for dependent steps
- **Parallel** for independent tasks
- **Conditional** for branching logic
- **Critique** for quality improvement
- **Refinement** for iterative enhancement

### 2. Set Reasonable Token Limits
```typescript
contextPolicy: {
  maxSharedTokens: 10000,  // Prevent excessive costs
  shareConversationHistory: false  // Only share when needed
}
```

### 3. Use Retry Logic for Critical Steps
```typescript
{
  id: 'critical_step',
  retryOnFailure: true,
  maxRetries: 3,
  timeout: 30000
}
```

### 4. Monitor Long-Running Flows
```typescript
// Always monitor progress for flows with many steps
const status = await orchestratorService.getFlowStatus(flowId);
if (status.progress < 50 && elapsed > 60000) {
  await orchestratorService.cancelFlow(flowId, userId);
}
```

### 5. Save Important Results
```typescript
// Enable message saving for audit trail
await orchestratorService.executeFlow(flowId, userId, {
  saveMessages: true  // Saves step results as thread messages
});
```

### 6. Handle Errors Gracefully
```typescript
try {
  const result = await orchestratorService.executeFlow(flowId, userId);
} catch (error) {
  // Get partial results even on failure
  const flow = await orchestratorService.getFlow(flowId, userId);
  const completedSteps = flow.stepResults.filter(r => r.status === 'SUCCESS');
  // Use partial results if valuable
}
```

## Integration with Other Services

### With ConversationService
```typescript
// Flow results automatically saved as messages if enabled
const result = await orchestratorService.executeFlow(flowId, userId, {
  saveMessages: true,
  threadId: threadId
});

// Retrieve orchestrated messages
const messages = await conversationService.getMessages(threadId, userId);
const orchestratedMessages = messages.filter(m =>
  m.metadata?.orchestrationFlowId === flowId
);
```

### With ProviderService
```typescript
// Orchestrator uses ProviderService internally
// All provider configurations are automatically used
// No additional setup needed
```

### With PermissionService
```typescript
// Permissions automatically checked
// User must have appropriate access to thread
// Flows inherit thread permissions
```

## Troubleshooting

### Flow Not Starting
- Check thread exists and user has write permission
- Verify provider configurations are active
- Check data sharing policies allow required operations

### Flow Failing Mid-Execution
- Check step timeout settings
- Verify API keys are valid
- Review data sharing policies
- Check token limits aren't exceeded

### High Costs
- Review `maxSharedTokens` in context policy
- Disable `shareConversationHistory` if not needed
- Use lower-cost models for intermediate steps
- Set appropriate `maxTokens` per step

### Slow Execution
- Use parallel flows when steps are independent
- Reduce `maxTokens` for faster responses
- Skip unnecessary validation steps
- Use faster models for simple tasks

## Advanced Topics

### Custom Step Conditions
```typescript
condition: async (context) => {
  // Complex logic
  const score = parseFloat(context.previousStepOutput.match(/\d+\.\d+/)?.[0] || '0');
  const hasErrors = context.previousStepOutput.includes('ERROR');
  return score > 0.7 && !hasErrors;
}
```

### Dynamic Prompts
```typescript
prompt: async (context) => {
  // Can be async
  const data = await fetchExternalData();
  return `Analyze ${context.originalPrompt} with context: ${data}`;
}
```

### Streaming Updates
```typescript
await orchestratorService.executeFlow(flowId, userId, {
  streaming: true,
  onUpdate: (update) => {
    switch (update.type) {
      case 'step_start':
        console.log('Starting:', update.stepId);
        break;
      case 'step_progress':
        console.log('Progress:', update.data);
        break;
      case 'step_complete':
        console.log('Completed:', update.stepId);
        break;
      case 'flow_complete':
        console.log('Done!', update.data);
        break;
      case 'error':
        console.error('Error:', update.data);
        break;
    }
  }
});
```

## API Reference

See `orchestrator.types.ts` for complete type definitions.

## Examples

See `orchestrator.examples.ts` for 10 comprehensive usage examples covering all features.

## Support

For issues or questions:
1. Check this documentation
2. Review examples in `orchestrator.examples.ts`
3. Check entity definitions in `../entities/`
4. Review service integration tests

---

**Version**: 1.0.0
**Last Updated**: 2025-11-15
**License**: Proprietary
