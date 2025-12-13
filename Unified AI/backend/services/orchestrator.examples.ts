/**
 * Orchestrator Service Usage Examples
 *
 * This file demonstrates how to use the OrchestratorService for various
 * multi-AI collaboration scenarios.
 */

import { orchestratorService } from './orchestrator.service';
import {
  FlowDefinition,
  StepAction,
  StepContext,
} from './orchestrator.types';
import { OrchestrationFlowType } from '../entities/OrchestrationFlow';
import {
  createCritiqueFlow,
  createComparisonFlow,
  createRefinementFlow,
  createSequentialAnalysisFlow,
  createConditionalRoutingFlow,
  createConsensusFlow,
  createQualityAssuranceFlow,
} from './flow-templates';

// ============================================================================
// EXAMPLE 1: Simple Critique Flow
// ============================================================================

/**
 * Example: GPT-4 generates code, Claude critiques it, GPT-4 refines
 */
export async function exampleCritiqueFlow(threadId: string, userId: string) {
  // Create flow using template
  const flowDef = createCritiqueFlow('openai', 'gpt-4', 'anthropic', 'claude-3-opus-20240229');

  // Create flow in database
  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  console.log(`Created critique flow: ${flow.id}`);

  // Execute flow
  const result = await orchestratorService.executeFlow(flow.id, userId, {
    streaming: true,
    onUpdate: (update) => {
      console.log(`[${update.type}] Step: ${update.stepId}`, update.data);
    },
  });

  console.log('Final output:', result.finalOutput);
  console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
  console.log(`Total tokens: ${result.totalTokens}`);
  console.log(`Execution time: ${result.totalExecutionTime}ms`);

  return result;
}

// ============================================================================
// EXAMPLE 2: Parallel Comparison
// ============================================================================

/**
 * Example: Ask same question to GPT-4, Claude, and Gemini, then compare
 */
export async function exampleComparisonFlow(threadId: string, userId: string) {
  const flowDef = createComparisonFlow([
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'anthropic', model: 'claude-3-opus-20240229' },
    { provider: 'google', model: 'gemini-pro' },
  ]);

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);
  const result = await orchestratorService.executeFlow(flow.id, userId);

  // All parallel responses will be aggregated
  console.log('Comparison result:', result.finalOutput);

  return result;
}

// ============================================================================
// EXAMPLE 3: Custom Sequential Flow
// ============================================================================

/**
 * Example: Custom flow - translate, summarize, analyze sentiment
 */
export async function exampleCustomSequentialFlow(threadId: string, userId: string) {
  const flowDef: FlowDefinition = {
    name: 'Translation Pipeline',
    description: 'Translate, summarize, and analyze sentiment',
    type: OrchestrationFlowType.SEQUENTIAL,
    steps: [
      {
        id: 'translate',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.TRANSFORM,
        prompt: (context: StepContext) => {
          return `Translate the following text to English:\n\n${context.originalPrompt}`;
        },
        settings: {
          temperature: 0.3,
          maxTokens: 2000,
        },
      },
      {
        id: 'summarize',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.SUMMARIZE,
        prompt: (context: StepContext) => {
          return `Summarize this text in 3-5 sentences:\n\n${context.previousStepOutput}`;
        },
        inputFrom: 'translate',
        settings: {
          temperature: 0.5,
          maxTokens: 500,
        },
      },
      {
        id: 'sentiment',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.ANALYZE,
        prompt: (context: StepContext) => {
          const translation = context.previousStepOutputs['translate'] || '';
          return `Analyze the sentiment of this text (positive, negative, neutral) and explain why:\n\n${translation}`;
        },
        inputFrom: 'translate',
        settings: {
          temperature: 0.2,
          maxTokens: 300,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 10000,
      includeOriginalPrompt: true,
    },
  };

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);
  const result = await orchestratorService.executeFlow(flow.id, userId);

  return result;
}

// ============================================================================
// EXAMPLE 4: Conditional Flow with Error Handling
// ============================================================================

/**
 * Example: Check complexity, route to appropriate expert, validate output
 */
export async function exampleConditionalFlow(threadId: string, userId: string) {
  const flowDef: FlowDefinition = {
    name: 'Smart Routing with Validation',
    description: 'Route based on complexity and validate output',
    type: OrchestrationFlowType.CONDITIONAL,
    steps: [
      {
        id: 'assess_complexity',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.ANALYZE,
        prompt: (context: StepContext) => {
          return `Rate the technical complexity of this request on a scale of 1-10:\n\n${context.originalPrompt}\n\nRespond with just the number.`;
        },
        settings: {
          temperature: 0.1,
          maxTokens: 10,
        },
      },
      {
        id: 'simple_response',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        condition: (context: StepContext) => {
          const complexity = parseInt(context.previousStepOutput || '5');
          return complexity <= 5;
        },
        settings: {
          temperature: 0.7,
          maxTokens: 1500,
        },
      },
      {
        id: 'complex_response',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.GENERATE,
        prompt: (context: StepContext) => {
          return `Provide a detailed, expert-level response to:\n\n${context.originalPrompt}`;
        },
        condition: (context: StepContext) => {
          const complexity = parseInt(
            context.previousStepOutputs['assess_complexity'] || '5'
          );
          return complexity > 5;
        },
        settings: {
          temperature: 0.5,
          maxTokens: 3000,
        },
      },
      {
        id: 'validate',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.VALIDATE,
        prompt: (context: StepContext) => {
          const response =
            context.previousStepOutputs['simple_response'] ||
            context.previousStepOutputs['complex_response'] ||
            '';
          return `Check if this response fully addresses the original question. Respond with YES or NO and brief explanation:\n\nQuestion: ${context.originalPrompt}\n\nResponse: ${response}`;
        },
        inputFrom: 'previous',
        settings: {
          temperature: 0.2,
          maxTokens: 200,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 8000,
      includeOriginalPrompt: true,
    },
  };

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);
  const result = await orchestratorService.executeFlow(flow.id, userId);

  return result;
}

// ============================================================================
// EXAMPLE 5: Iterative Refinement with Quality Threshold
// ============================================================================

/**
 * Example: Keep refining until quality threshold is met
 */
export async function exampleRefinementFlow(threadId: string, userId: string) {
  // Using template with custom threshold
  const flowDef = createRefinementFlow(5, 0.85); // Max 5 iterations, 0.85 quality threshold

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  // Execute with progress tracking
  const result = await orchestratorService.executeFlow(flow.id, userId, {
    streaming: true,
    onUpdate: (update) => {
      if (update.type === 'step_complete') {
        const stepData = update.data as any;
        console.log(`Step ${stepData.stepId} completed in ${stepData.executionTime}ms`);
        if (stepData.output) {
          console.log('Output preview:', stepData.output.substring(0, 100) + '...');
        }
      }
    },
  });

  // Check how many refinement iterations occurred
  const refinementSteps = result.steps.filter((s) => s.action === StepAction.REFINE);
  console.log(`Refinement iterations: ${refinementSteps.length}`);

  return result;
}

// ============================================================================
// EXAMPLE 6: Execute Individual Steps
// ============================================================================

/**
 * Example: Execute steps manually for debugging or custom control
 */
export async function exampleStepByStepExecution(
  threadId: string,
  userId: string
) {
  // Create a simple flow
  const flowDef: FlowDefinition = {
    name: 'Manual Step Execution',
    type: OrchestrationFlowType.SEQUENTIAL,
    steps: [
      {
        id: 'step1',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: { temperature: 0.7 },
      },
      {
        id: 'step2',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.CRITIQUE,
        prompt: (context) => `Critique this: ${context.previousStepOutput}`,
        inputFrom: 'step1',
        settings: { temperature: 0.3 },
      },
    ],
  };

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  // Execute step 1
  console.log('Executing step 1...');
  const step1Result = await orchestratorService.executeStep(
    flow.id,
    'step1',
    userId
  );
  console.log('Step 1 output:', step1Result.output);

  // Execute step 2 with custom input
  console.log('Executing step 2...');
  const step2Result = await orchestratorService.executeStep(
    flow.id,
    'step2',
    userId,
    step1Result.output
  );
  console.log('Step 2 output:', step2Result.output);

  return { step1Result, step2Result };
}

// ============================================================================
// EXAMPLE 7: Flow Monitoring and Cancellation
// ============================================================================

/**
 * Example: Monitor flow progress and cancel if needed
 */
export async function exampleFlowMonitoring(threadId: string, userId: string) {
  // Create a long-running flow
  const flowDef = createSequentialAnalysisFlow();
  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  // Start execution in background
  const executionPromise = orchestratorService.executeFlow(flow.id, userId, {
    streaming: true,
    onUpdate: (update) => {
      console.log(`[${update.timestamp.toISOString()}] ${update.type}:`, update.data);
    },
  });

  // Monitor progress
  const monitorInterval = setInterval(async () => {
    const status = await orchestratorService.getFlowStatus(flow.id);
    console.log(
      `Progress: ${status.progress.toFixed(1)}% (${status.completedSteps}/${status.totalSteps} steps)`
    );

    // Cancel after 30 seconds (example)
    if (status.startedAt) {
      const elapsed = Date.now() - status.startedAt.getTime();
      if (elapsed > 30000) {
        console.log('Cancelling flow due to timeout...');
        await orchestratorService.cancelFlow(flow.id, userId);
        clearInterval(monitorInterval);
      }
    }
  }, 2000);

  try {
    const result = await executionPromise;
    clearInterval(monitorInterval);
    return result;
  } catch (error) {
    clearInterval(monitorInterval);
    console.error('Flow execution failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 8: List and Manage Flows
// ============================================================================

/**
 * Example: List all flows for a thread and get details
 */
export async function exampleFlowManagement(threadId: string, userId: string) {
  // List all flows
  const allFlows = await orchestratorService.listFlows(threadId, userId);
  console.log(`Total flows: ${allFlows.length}`);

  // List only completed flows
  const completedFlows = await orchestratorService.listFlows(threadId, userId, {
    status: OrchestrationFlowStatus.COMPLETED,
    limit: 10,
    sortBy: 'completedAt',
    sortOrder: 'DESC',
  });
  console.log(`Completed flows: ${completedFlows.length}`);

  // Get details of first flow
  if (completedFlows.length > 0) {
    const flowId = completedFlows[0].id;
    const flow = await orchestratorService.getFlow(flowId, userId);

    console.log('Flow details:', {
      id: flow.id,
      name: flow.name,
      type: flow.flowType,
      status: flow.status,
      stepCount: flow.steps.length,
      stepResults: flow.stepResults.length,
    });

    // Analyze step results
    for (const stepResult of flow.stepResults) {
      console.log(`  Step ${stepResult.stepId}: ${stepResult.status}`);
      if (stepResult.metadata) {
        const metadata = stepResult.metadata as any;
        console.log(`    Tokens: ${metadata.usage?.totalTokens || 0}`);
        console.log(`    Cost: $${metadata.cost?.toFixed(4) || '0.0000'}`);
      }
    }
  }

  // Delete old flows (example)
  const oldFlows = await orchestratorService.listFlows(threadId, userId, {
    status: OrchestrationFlowStatus.COMPLETED,
    sortBy: 'completedAt',
    sortOrder: 'ASC',
    limit: 5,
  });

  for (const flow of oldFlows) {
    await orchestratorService.deleteFlow(flow.id, userId);
    console.log(`Deleted flow: ${flow.id}`);
  }
}

// ============================================================================
// EXAMPLE 9: Using All Pre-built Templates
// ============================================================================

import { OrchestrationFlowStatus } from '../entities/OrchestrationFlow';

/**
 * Example: Demonstrate all pre-built templates
 */
export async function exampleAllTemplates(threadId: string, userId: string) {
  console.log('=== CRITIQUE FLOW ===');
  const critiqueFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createCritiqueFlow()
  );
  console.log(`Created: ${critiqueFlow.id}`);

  console.log('\n=== COMPARISON FLOW ===');
  const comparisonFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createComparisonFlow()
  );
  console.log(`Created: ${comparisonFlow.id}`);

  console.log('\n=== REFINEMENT FLOW ===');
  const refinementFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createRefinementFlow(3, 0.8)
  );
  console.log(`Created: ${refinementFlow.id}`);

  console.log('\n=== SEQUENTIAL ANALYSIS FLOW ===');
  const analysisFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createSequentialAnalysisFlow()
  );
  console.log(`Created: ${analysisFlow.id}`);

  console.log('\n=== CONDITIONAL ROUTING FLOW ===');
  const routingFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createConditionalRoutingFlow()
  );
  console.log(`Created: ${routingFlow.id}`);

  console.log('\n=== CONSENSUS FLOW ===');
  const consensusFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createConsensusFlow()
  );
  console.log(`Created: ${consensusFlow.id}`);

  console.log('\n=== QUALITY ASSURANCE FLOW ===');
  const qaFlow = await orchestratorService.createFlow(
    threadId,
    userId,
    createQualityAssuranceFlow()
  );
  console.log(`Created: ${qaFlow.id}`);

  return {
    critiqueFlow,
    comparisonFlow,
    refinementFlow,
    analysisFlow,
    routingFlow,
    consensusFlow,
    qaFlow,
  };
}

// ============================================================================
// EXAMPLE 10: Error Handling and Retry Logic
// ============================================================================

/**
 * Example: Handle errors gracefully with retry logic
 */
export async function exampleErrorHandling(threadId: string, userId: string) {
  const flowDef: FlowDefinition = {
    name: 'Resilient Flow with Retry',
    description: 'Demonstrates retry logic and error handling',
    type: OrchestrationFlowType.SEQUENTIAL,
    steps: [
      {
        id: 'attempt_request',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        retryOnFailure: true,
        maxRetries: 3,
        timeout: 30000, // 30 second timeout
        settings: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
      {
        id: 'validate_response',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.VALIDATE,
        prompt: (context: StepContext) => {
          return `Validate if this response makes sense:\n\n${context.previousStepOutput}`;
        },
        inputFrom: 'attempt_request',
        retryOnFailure: false, // Don't retry validation
        settings: {
          temperature: 0.2,
          maxTokens: 500,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: true,
      shareStepOutputs: true,
      maxSharedTokens: 8000,
      includeOriginalPrompt: true,
    },
  };

  const flow = await orchestratorService.createFlow(threadId, userId, flowDef);

  try {
    const result = await orchestratorService.executeFlow(flow.id, userId, {
      streaming: true,
      onUpdate: (update) => {
        if (update.type === 'error') {
          console.error('Flow error:', update.data);
        }
      },
    });

    console.log('Flow completed successfully');
    return result;
  } catch (error) {
    console.error('Flow failed after all retries:', error);

    // Get flow status to see what failed
    const status = await orchestratorService.getFlowStatus(flow.id);
    console.log('Failed at step:', status.currentStepIndex);
    console.log('Completed steps:', status.completedSteps);
    console.log('Failed steps:', status.failedSteps);

    throw error;
  }
}
