/**
 * Orchestrator Service
 *
 * Comprehensive service for managing multi-AI orchestration flows where AIs can
 * "talk to each other" and collaborate on complex tasks. Supports sequential,
 * parallel, conditional, critique, and refinement workflows.
 */

import { Repository, DataSource } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { OrchestrationFlow, OrchestrationFlowType, OrchestrationFlowStatus } from '../entities/OrchestrationFlow';
import { OrchestrationStepResult, OrchestrationStepStatus } from '../entities/OrchestrationStepResult';
import { Thread } from '../entities/Thread';
import { Message, MessageRole } from '../entities/Message';
import { DataSharingPolicy } from '../entities/DataSharingPolicy';
import { providerService } from './provider.service';
import { conversationService } from './conversation.service';
import { permissionService } from './permission.service';
import { PermissionEntityType } from '../entities/PermissionSet';
import {
  FlowDefinition,
  FlowStep,
  FlowStepResult,
  FlowExecutionResult,
  FlowStatus,
  FlowError,
  FlowStreamUpdate,
  StepContext,
  StepAction,
  ExecutionOptions,
  StepExecutionInput,
  FlowListOptions,
  ContextPolicy,
  ParallelExecutionResult,
} from './orchestrator.types';
import {
  MessageRequest,
  MessageResponse,
  ConversationMessage,
} from '../adapters/base/AIProviderAdapter.interface';

/**
 * Default context policy
 */
const DEFAULT_CONTEXT_POLICY: ContextPolicy = {
  shareConversationHistory: false,
  shareStepOutputs: true,
  maxSharedTokens: 10000,
  includeOriginalPrompt: true,
  preserveSystemPrompts: false,
};

/**
 * Orchestrator Service Error
 */
export class OrchestratorServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'OrchestratorServiceError';
  }
}

/**
 * Orchestrator Service
 */
export class OrchestratorService {
  private flowRepository: Repository<OrchestrationFlow>;
  private stepResultRepository: Repository<OrchestrationStepResult>;
  private threadRepository: Repository<Thread>;
  private messageRepository: Repository<Message>;
  private dataSharingRepository: Repository<DataSharingPolicy>;
  private dataSource: DataSource;

  // Active flow cancellation tokens
  private cancellationTokens: Map<string, boolean> = new Map();

  constructor() {
    this.dataSource = AppDataSource;
    this.flowRepository = this.dataSource.getRepository(OrchestrationFlow);
    this.stepResultRepository = this.dataSource.getRepository(OrchestrationStepResult);
    this.threadRepository = this.dataSource.getRepository(Thread);
    this.messageRepository = this.dataSource.getRepository(Message);
    this.dataSharingRepository = this.dataSource.getRepository(DataSharingPolicy);
  }

  // ============================================================================
  // FLOW MANAGEMENT
  // ============================================================================

  /**
   * Create a new orchestration flow
   */
  async createFlow(
    threadId: string,
    userId: string,
    flowDefinition: FlowDefinition
  ): Promise<OrchestrationFlow> {
    // Validate inputs
    if (!threadId || !userId || !flowDefinition) {
      throw new OrchestratorServiceError(
        'threadId, userId, and flowDefinition are required',
        'INVALID_INPUT',
        400
      );
    }

    // Validate thread exists and user has access
    const thread = await conversationService.getThread(threadId, userId);
    if (!thread) {
      throw new OrchestratorServiceError(
        `Thread not found: ${threadId}`,
        'THREAD_NOT_FOUND',
        404
      );
    }

    // Validate flow definition
    this.validateFlowDefinition(flowDefinition);

    // Check if user has write permission
    const canWrite = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'write'
    );

    if (!canWrite) {
      throw new OrchestratorServiceError(
        'Insufficient permissions to create flow in this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    // Create flow entity
    const flow = this.flowRepository.create({
      threadId,
      name: flowDefinition.name,
      description: flowDefinition.description,
      flowType: flowDefinition.type,
      steps: flowDefinition.steps as any[],
      currentStepIndex: 0,
      status: OrchestrationFlowStatus.PENDING,
    });

    const savedFlow = await this.flowRepository.save(flow);

    return savedFlow;
  }

  /**
   * Get a flow by ID
   */
  async getFlow(flowId: string, userId: string): Promise<OrchestrationFlow> {
    if (!flowId || !userId) {
      throw new OrchestratorServiceError(
        'flowId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      relations: ['thread', 'stepResults'],
    });

    if (!flow) {
      throw new OrchestratorServiceError(
        `Flow not found: ${flowId}`,
        'FLOW_NOT_FOUND',
        404
      );
    }

    // Check thread permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      flow.threadId,
      'read'
    );

    if (!canRead) {
      throw new OrchestratorServiceError(
        'Insufficient permissions to access this flow',
        'PERMISSION_DENIED',
        403
      );
    }

    return flow;
  }

  /**
   * List flows for a thread
   */
  async listFlows(
    threadId: string,
    userId: string,
    options: FlowListOptions = {}
  ): Promise<OrchestrationFlow[]> {
    if (!threadId || !userId) {
      throw new OrchestratorServiceError(
        'threadId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    // Check thread permission
    const canRead = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      threadId,
      'read'
    );

    if (!canRead) {
      throw new OrchestratorServiceError(
        'Insufficient permissions to access flows in this thread',
        'PERMISSION_DENIED',
        403
      );
    }

    // Build query
    const queryBuilder = this.flowRepository
      .createQueryBuilder('flow')
      .where('flow.threadId = :threadId', { threadId })
      .leftJoinAndSelect('flow.stepResults', 'stepResults');

    // Apply filters
    if (options.status) {
      queryBuilder.andWhere('flow.status = :status', { status: options.status });
    }

    if (options.type) {
      queryBuilder.andWhere('flow.flowType = :type', { type: options.type });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'DESC';
    queryBuilder.orderBy(`flow.${sortBy}`, sortOrder);

    // Pagination
    if (options.limit) {
      queryBuilder.take(options.limit);
    }

    if (options.offset) {
      queryBuilder.skip(options.offset);
    }

    const flows = await queryBuilder.getMany();

    return flows;
  }

  /**
   * Delete a flow
   */
  async deleteFlow(flowId: string, userId: string): Promise<void> {
    if (!flowId || !userId) {
      throw new OrchestratorServiceError(
        'flowId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const flow = await this.getFlow(flowId, userId);

    // Check if user has delete permission
    const canDelete = await permissionService.canUserAccess(
      userId,
      PermissionEntityType.THREAD,
      flow.threadId,
      'delete'
    );

    if (!canDelete) {
      throw new OrchestratorServiceError(
        'Insufficient permissions to delete this flow',
        'PERMISSION_DENIED',
        403
      );
    }

    // Cancel if running
    if (flow.status === OrchestrationFlowStatus.RUNNING) {
      await this.cancelFlow(flowId, userId);
    }

    // Delete flow (cascade will delete step results)
    await this.flowRepository.remove(flow);
  }

  // ============================================================================
  // FLOW EXECUTION
  // ============================================================================

  /**
   * Execute an entire flow
   */
  async executeFlow(
    flowId: string,
    userId: string,
    options: Partial<ExecutionOptions> = {}
  ): Promise<FlowExecutionResult> {
    if (!flowId || !userId) {
      throw new OrchestratorServiceError(
        'flowId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const flow = await this.getFlow(flowId, userId);

    // Check if flow is already running
    if (flow.status === OrchestrationFlowStatus.RUNNING) {
      throw new OrchestratorServiceError(
        'Flow is already running',
        'FLOW_ALREADY_RUNNING',
        409
      );
    }

    // Initialize cancellation token
    this.cancellationTokens.set(flowId, false);

    // Update flow status
    flow.status = OrchestrationFlowStatus.RUNNING;
    flow.startedAt = new Date();
    flow.currentStepIndex = 0;
    await this.flowRepository.save(flow);

    const startTime = Date.now();
    const executionOptions: ExecutionOptions = {
      userId,
      threadId: flow.threadId,
      streaming: false,
      saveMessages: true,
      ...options,
    };

    try {
      // Execute based on flow type
      let result: FlowExecutionResult;

      switch (flow.flowType) {
        case OrchestrationFlowType.SEQUENTIAL:
          result = await this.executeSequentialFlow(flow, executionOptions);
          break;

        case OrchestrationFlowType.PARALLEL:
          result = await this.executeParallelFlow(flow, executionOptions);
          break;

        case OrchestrationFlowType.CONDITIONAL:
          result = await this.executeConditionalFlow(flow, executionOptions);
          break;

        case OrchestrationFlowType.CRITIQUE:
          result = await this.executeCritiqueFlow(flow, executionOptions);
          break;

        case OrchestrationFlowType.REFINEMENT:
          result = await this.executeRefinementFlow(flow, executionOptions);
          break;

        default:
          throw new OrchestratorServiceError(
            `Unsupported flow type: ${flow.flowType}`,
            'UNSUPPORTED_FLOW_TYPE',
            400
          );
      }

      // Update flow with results
      flow.status = OrchestrationFlowStatus.COMPLETED;
      flow.completedAt = new Date();
      flow.result = result as any;
      await this.flowRepository.save(flow);

      // Emit completion event
      if (executionOptions.onUpdate) {
        executionOptions.onUpdate({
          type: 'flow_complete',
          flowId,
          data: result,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      // Handle execution error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      flow.status = this.cancellationTokens.get(flowId)
        ? OrchestrationFlowStatus.CANCELLED
        : OrchestrationFlowStatus.FAILED;
      flow.completedAt = new Date();
      flow.result = { error: errorMessage } as any;
      await this.flowRepository.save(flow);

      // Emit error event
      if (executionOptions.onUpdate) {
        executionOptions.onUpdate({
          type: 'error',
          flowId,
          data: { error: errorMessage },
          timestamp: new Date(),
        });
      }

      throw new OrchestratorServiceError(
        `Flow execution failed: ${errorMessage}`,
        'FLOW_EXECUTION_FAILED',
        500
      );
    } finally {
      // Clean up cancellation token
      this.cancellationTokens.delete(flowId);
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(
    flowId: string,
    stepId: string,
    userId: string,
    input?: string
  ): Promise<FlowStepResult> {
    if (!flowId || !stepId || !userId) {
      throw new OrchestratorServiceError(
        'flowId, stepId, and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const flow = await this.getFlow(flowId, userId);

    // Find step definition
    const stepDef = (flow.steps as FlowStep[]).find((s) => s.id === stepId);
    if (!stepDef) {
      throw new OrchestratorServiceError(
        `Step not found: ${stepId}`,
        'STEP_NOT_FOUND',
        404
      );
    }

    // Build context
    const context = await this.buildStepContext(flow, stepDef, input);

    // Execute step
    const result = await this.executeSingleStep(flow, stepDef, context, {
      userId,
      threadId: flow.threadId,
      saveMessages: true,
    });

    return result;
  }

  /**
   * Cancel a running flow
   */
  async cancelFlow(flowId: string, userId: string): Promise<void> {
    if (!flowId || !userId) {
      throw new OrchestratorServiceError(
        'flowId and userId are required',
        'INVALID_INPUT',
        400
      );
    }

    const flow = await this.getFlow(flowId, userId);

    if (flow.status !== OrchestrationFlowStatus.RUNNING) {
      throw new OrchestratorServiceError(
        'Flow is not currently running',
        'FLOW_NOT_RUNNING',
        400
      );
    }

    // Set cancellation token
    this.cancellationTokens.set(flowId, true);

    // Update flow status
    flow.status = OrchestrationFlowStatus.CANCELLED;
    flow.completedAt = new Date();
    await this.flowRepository.save(flow);
  }

  /**
   * Get flow execution status
   */
  async getFlowStatus(flowId: string): Promise<FlowStatus> {
    const flow = await this.flowRepository.findOne({
      where: { id: flowId },
      relations: ['stepResults'],
    });

    if (!flow) {
      throw new OrchestratorServiceError(
        `Flow not found: ${flowId}`,
        'FLOW_NOT_FOUND',
        404
      );
    }

    const totalSteps = (flow.steps as FlowStep[]).length;
    const completedSteps = flow.stepResults.filter(
      (r) => r.status === OrchestrationStepStatus.SUCCESS
    ).length;
    const failedSteps = flow.stepResults.filter(
      (r) => r.status === OrchestrationStepStatus.FAILED
    ).length;

    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return {
      flowId,
      status: flow.status,
      currentStepIndex: flow.currentStepIndex,
      totalSteps,
      completedSteps,
      failedSteps,
      progress,
      startedAt: flow.startedAt,
    };
  }

  // ============================================================================
  // FLOW TYPE EXECUTORS
  // ============================================================================

  /**
   * Execute sequential flow - steps run one after another
   */
  private async executeSequentialFlow(
    flow: OrchestrationFlow,
    options: ExecutionOptions
  ): Promise<FlowExecutionResult> {
    const steps = flow.steps as FlowStep[];
    const stepResults: FlowStepResult[] = [];
    let totalCost = 0;
    let totalTokens = 0;
    const startTime = Date.now();

    for (let i = 0; i < steps.length; i++) {
      // Check cancellation
      if (this.cancellationTokens.get(flow.id)) {
        throw new Error('Flow cancelled');
      }

      const step = steps[i];

      // Update current step index
      flow.currentStepIndex = i;
      await this.flowRepository.save(flow);

      // Emit step start event
      if (options.onUpdate) {
        options.onUpdate({
          type: 'step_start',
          flowId: flow.id,
          stepId: step.id,
          data: { stepIndex: i, stepAction: step.action },
          timestamp: new Date(),
        });
      }

      // Build context
      const context = await this.buildStepContext(flow, step, undefined, stepResults);

      // Check step condition
      if (step.condition) {
        const shouldExecute = await step.condition(context);
        if (!shouldExecute) {
          // Skip this step
          stepResults.push({
            stepId: step.id,
            stepIndex: i,
            provider: step.provider,
            model: step.model,
            action: step.action,
            status: OrchestrationStepStatus.SKIPPED,
            executionTime: 0,
            retryCount: 0,
            timestamp: new Date(),
          });
          continue;
        }
      }

      // Execute step
      const result = await this.executeSingleStep(flow, step, context, options);
      stepResults.push(result);

      if (result.usage) {
        totalTokens += result.usage.totalTokens;
      }
      if (result.cost) {
        totalCost += result.cost;
      }

      // Emit step complete event
      if (options.onUpdate) {
        options.onUpdate({
          type: 'step_complete',
          flowId: flow.id,
          stepId: step.id,
          data: result,
          timestamp: new Date(),
        });
      }

      // Stop if step failed and retry is disabled
      if (result.status === OrchestrationStepStatus.FAILED && !step.retryOnFailure) {
        break;
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    // Get final output (from last successful step)
    const lastSuccessfulStep = stepResults
      .slice()
      .reverse()
      .find((r) => r.status === OrchestrationStepStatus.SUCCESS);

    return {
      flowId: flow.id,
      flowType: flow.flowType,
      status: OrchestrationFlowStatus.COMPLETED,
      steps: stepResults,
      finalOutput: lastSuccessfulStep?.output,
      totalCost,
      totalTokens,
      totalExecutionTime,
      startedAt: flow.startedAt!,
      completedAt: new Date(),
    };
  }

  /**
   * Execute parallel flow - steps run simultaneously
   */
  private async executeParallelFlow(
    flow: OrchestrationFlow,
    options: ExecutionOptions
  ): Promise<FlowExecutionResult> {
    const steps = flow.steps as FlowStep[];
    const startTime = Date.now();

    // Execute all steps in parallel
    const stepPromises = steps.map(async (step, index) => {
      // Check cancellation
      if (this.cancellationTokens.get(flow.id)) {
        throw new Error('Flow cancelled');
      }

      // Emit step start event
      if (options.onUpdate) {
        options.onUpdate({
          type: 'step_start',
          flowId: flow.id,
          stepId: step.id,
          data: { stepIndex: index, stepAction: step.action },
          timestamp: new Date(),
        });
      }

      // Build context (no previous steps in parallel execution)
      const context = await this.buildStepContext(flow, step, undefined, []);

      // Execute step
      const result = await this.executeSingleStep(flow, step, context, options);

      // Emit step complete event
      if (options.onUpdate) {
        options.onUpdate({
          type: 'step_complete',
          flowId: flow.id,
          stepId: step.id,
          data: result,
          timestamp: new Date(),
        });
      }

      return result;
    });

    // Wait for all steps to complete
    const stepResults = await Promise.all(stepPromises);

    const totalExecutionTime = Date.now() - startTime;
    const totalCost = stepResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalTokens = stepResults.reduce(
      (sum, r) => sum + (r.usage?.totalTokens || 0),
      0
    );

    // Aggregate outputs
    const outputs = stepResults
      .filter((r) => r.status === OrchestrationStepStatus.SUCCESS)
      .map((r) => r.output)
      .join('\n\n---\n\n');

    return {
      flowId: flow.id,
      flowType: flow.flowType,
      status: OrchestrationFlowStatus.COMPLETED,
      steps: stepResults,
      finalOutput: outputs,
      totalCost,
      totalTokens,
      totalExecutionTime,
      startedAt: flow.startedAt!,
      completedAt: new Date(),
    };
  }

  /**
   * Execute conditional flow - steps based on previous results
   */
  private async executeConditionalFlow(
    flow: OrchestrationFlow,
    options: ExecutionOptions
  ): Promise<FlowExecutionResult> {
    // Conditional flows are executed like sequential flows but with condition checking
    return this.executeSequentialFlow(flow, options);
  }

  /**
   * Execute critique flow - one AI reviews another's output
   */
  private async executeCritiqueFlow(
    flow: OrchestrationFlow,
    options: ExecutionOptions
  ): Promise<FlowExecutionResult> {
    // Critique flows are a specialized sequential flow
    return this.executeSequentialFlow(flow, options);
  }

  /**
   * Execute refinement flow - iterative improvement
   */
  private async executeRefinementFlow(
    flow: OrchestrationFlow,
    options: ExecutionOptions
  ): Promise<FlowExecutionResult> {
    // Refinement flows are sequential with iteration logic in conditions
    return this.executeSequentialFlow(flow, options);
  }

  // ============================================================================
  // STEP EXECUTION HELPERS
  // ============================================================================

  /**
   * Execute a single step with retry logic
   */
  private async executeSingleStep(
    flow: OrchestrationFlow,
    step: FlowStep,
    context: StepContext,
    options: ExecutionOptions
  ): Promise<FlowStepResult> {
    const startTime = Date.now();
    const maxRetries = step.maxRetries || 0;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= maxRetries) {
      try {
        // Get provider config
        const providerConfigs = await providerService.getUserProviderConfigs(options.userId);
        const providerConfig = providerConfigs.find((c) => c.providerKey === step.provider);

        if (!providerConfig || !providerConfig.isActive) {
          throw new Error(`Provider not configured or inactive: ${step.provider}`);
        }

        // Check data sharing policy
        await this.checkDataSharingPolicy(
          options.userId,
          step.provider,
          context.threadHistory.length > 0
        );

        // Build prompt
        const prompt = await this.buildPrompt(step, context);

        // Prepare messages
        const messages: ConversationMessage[] = [
          {
            role: 'user',
            content: prompt,
          },
        ];

        // Add context if policy allows
        if (context.threadHistory.length > 0) {
          // Add relevant thread history
          messages.unshift(...context.threadHistory);
        }

        // Prepare request
        const request: MessageRequest = {
          messages,
          model: step.model,
          temperature: step.settings?.temperature ?? 0.7,
          maxTokens: step.settings?.maxTokens ?? 2000,
          topP: step.settings?.topP,
          stopSequences: step.settings?.stopSequences,
        };

        // Execute AI request
        const response = await providerService.sendMessage(providerConfig.id, request);

        // Calculate cost
        const cost = await providerService.estimateCost(
          providerConfig.id,
          response.usage.promptTokens,
          response.usage.completionTokens,
          step.model
        );

        // Save step result to database
        const stepResult = this.stepResultRepository.create({
          flowId: flow.id,
          stepId: step.id,
          status: OrchestrationStepStatus.SUCCESS,
          output: response.content,
          metadata: {
            provider: step.provider,
            model: step.model,
            action: step.action,
            usage: response.usage,
            cost,
            retryCount,
          },
        });
        await this.stepResultRepository.save(stepResult);

        // Save as message if requested
        if (options.saveMessages && options.threadId) {
          await conversationService.addMessage({
            threadId: options.threadId,
            userId: options.userId,
            content: response.content,
            role: MessageRole.ASSISTANT,
            providerId: providerConfig.id,
            model: step.model,
            metadata: {
              orchestrationFlowId: flow.id,
              orchestrationStepId: step.id,
              stepAction: step.action,
            },
          });
        }

        const executionTime = Date.now() - startTime;

        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          provider: step.provider,
          model: step.model,
          action: step.action,
          status: OrchestrationStepStatus.SUCCESS,
          output: response.content,
          usage: response.usage,
          cost,
          executionTime,
          retryCount,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (retryCount <= maxRetries && step.retryOnFailure) {
          // Wait before retry
          await this.delay(1000 * retryCount);
          continue;
        }

        // Failed after retries
        const executionTime = Date.now() - startTime;

        // Save failed step result
        const stepResult = this.stepResultRepository.create({
          flowId: flow.id,
          stepId: step.id,
          status: OrchestrationStepStatus.FAILED,
          output: lastError.message,
          metadata: {
            provider: step.provider,
            model: step.model,
            action: step.action,
            error: lastError.message,
            retryCount,
          },
        });
        await this.stepResultRepository.save(stepResult);

        return {
          stepId: step.id,
          stepIndex: context.stepIndex,
          provider: step.provider,
          model: step.model,
          action: step.action,
          status: OrchestrationStepStatus.FAILED,
          error: lastError.message,
          executionTime,
          retryCount,
          timestamp: new Date(),
        };
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Unknown error');
  }

  /**
   * Build step context
   */
  private async buildStepContext(
    flow: OrchestrationFlow,
    step: FlowStep,
    customInput?: string,
    previousResults: FlowStepResult[] = []
  ): Promise<StepContext> {
    const steps = flow.steps as FlowStep[];
    const stepIndex = steps.findIndex((s) => s.id === step.id);

    // Get thread messages if needed
    let threadHistory: ConversationMessage[] = [];
    const messages = await this.messageRepository.find({
      where: { threadId: flow.threadId, isDeleted: false },
      order: { createdAt: 'ASC' },
      take: 50, // Limit to recent messages
    });

    threadHistory = messages.map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content,
    }));

    // Get original prompt (first user message)
    const originalPrompt =
      customInput ||
      messages.find((m) => m.role === MessageRole.USER)?.content ||
      '';

    // Build previous outputs map
    const previousStepOutputs: Record<string, string> = {};
    for (const result of previousResults) {
      if (result.output) {
        previousStepOutputs[result.stepId] = result.output;
      }
    }

    // Get previous step output based on inputFrom
    let previousStepOutput: string | undefined;
    if (step.inputFrom === 'previous' && previousResults.length > 0) {
      previousStepOutput = previousResults[previousResults.length - 1].output;
    } else if (step.inputFrom === 'original') {
      previousStepOutput = originalPrompt;
    } else if (typeof step.inputFrom === 'string' && step.inputFrom !== 'all') {
      previousStepOutput = previousStepOutputs[step.inputFrom];
    }

    return {
      flowId: flow.id,
      stepId: step.id,
      stepIndex,
      originalPrompt,
      previousStepOutput,
      previousStepOutputs,
      allStepResults: previousResults,
      threadHistory,
      metadata: {},
    };
  }

  /**
   * Build prompt for a step
   */
  private async buildPrompt(step: FlowStep, context: StepContext): Promise<string> {
    if (typeof step.prompt === 'function') {
      return await step.prompt(context);
    } else if (step.prompt === 'original') {
      return context.originalPrompt;
    } else if (step.prompt === 'previous') {
      return context.previousStepOutput || context.originalPrompt;
    } else {
      return step.prompt;
    }
  }

  /**
   * Check data sharing policy
   */
  private async checkDataSharingPolicy(
    userId: string,
    providerKey: string,
    sharingContext: boolean
  ): Promise<void> {
    const policy = await this.dataSharingRepository.findOne({
      where: { userId, providerKey },
    });

    if (!policy) {
      // No policy means allow by default
      return;
    }

    if (sharingContext && !policy.allowConversationHistory) {
      throw new OrchestratorServiceError(
        `Data sharing policy prevents sharing conversation history with ${providerKey}`,
        'DATA_SHARING_VIOLATION',
        403
      );
    }

    if (!policy.allowCrossProviderContext) {
      throw new OrchestratorServiceError(
        `Data sharing policy prevents cross-provider context sharing with ${providerKey}`,
        'DATA_SHARING_VIOLATION',
        403
      );
    }
  }

  /**
   * Validate flow definition
   */
  private validateFlowDefinition(flowDef: FlowDefinition): void {
    if (!flowDef.name || flowDef.name.trim() === '') {
      throw new OrchestratorServiceError(
        'Flow name is required',
        'INVALID_FLOW_DEFINITION',
        400
      );
    }

    if (!flowDef.steps || flowDef.steps.length === 0) {
      throw new OrchestratorServiceError(
        'Flow must have at least one step',
        'INVALID_FLOW_DEFINITION',
        400
      );
    }

    // Validate each step
    for (const step of flowDef.steps) {
      if (!step.id || !step.provider || !step.model || !step.action) {
        throw new OrchestratorServiceError(
          'Each step must have id, provider, model, and action',
          'INVALID_STEP_DEFINITION',
          400
        );
      }

      if (!step.prompt) {
        throw new OrchestratorServiceError(
          `Step ${step.id} must have a prompt`,
          'INVALID_STEP_DEFINITION',
          400
        );
      }
    }

    // Check for duplicate step IDs
    const stepIds = flowDef.steps.map((s) => s.id);
    const uniqueIds = new Set(stepIds);
    if (stepIds.length !== uniqueIds.size) {
      throw new OrchestratorServiceError(
        'Duplicate step IDs found',
        'INVALID_FLOW_DEFINITION',
        400
      );
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
export const orchestratorService = new OrchestratorService();
