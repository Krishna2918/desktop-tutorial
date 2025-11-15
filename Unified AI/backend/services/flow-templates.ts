/**
 * Flow Templates
 *
 * Pre-built orchestration flow templates for common multi-AI collaboration patterns.
 * These templates demonstrate best practices for different orchestration scenarios.
 */

import {
  FlowDefinition,
  StepAction,
  StepContext,
  FlowStepResult,
} from './orchestrator.types';
import { OrchestrationFlowType } from '../entities/OrchestrationFlow';
import { OrchestrationStepStatus } from '../entities/OrchestrationStepResult';

/**
 * Critique Flow Template
 * AI generates content, another AI critiques it, original AI refines based on feedback
 */
export function createCritiqueFlow(
  generatorProvider: string = 'openai',
  generatorModel: string = 'gpt-4',
  criticProvider: string = 'anthropic',
  criticModel: string = 'claude-3-opus-20240229'
): FlowDefinition {
  return {
    name: 'Critique and Refinement',
    description: 'One AI generates content, another critiques it, then refinement happens',
    type: OrchestrationFlowType.CRITIQUE,
    steps: [
      {
        id: 'generate',
        provider: generatorProvider,
        model: generatorModel,
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
      {
        id: 'critique',
        provider: criticProvider,
        model: criticModel,
        action: StepAction.CRITIQUE,
        prompt: (context: StepContext) => {
          const generatedContent = context.previousStepOutput || '';
          return `Please critique the following content. Identify strengths, weaknesses, and specific suggestions for improvement:

${generatedContent}

Provide constructive feedback focusing on:
1. Clarity and coherence
2. Accuracy and completeness
3. Structure and organization
4. Areas for improvement`;
        },
        inputFrom: 'generate',
        settings: {
          temperature: 0.3,
          maxTokens: 1500,
        },
      },
      {
        id: 'refine',
        provider: generatorProvider,
        model: generatorModel,
        action: StepAction.REFINE,
        prompt: (context: StepContext) => {
          const original = context.previousStepOutputs['generate'] || '';
          const critique = context.previousStepOutput || '';
          return `Based on the following critique, please improve the original content:

ORIGINAL CONTENT:
${original}

CRITIQUE:
${critique}

Please provide an improved version that addresses the feedback while maintaining the original intent.`;
        },
        inputFrom: 'critique',
        settings: {
          temperature: 0.6,
          maxTokens: 2000,
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
}

/**
 * Parallel Comparison Flow Template
 * Ask the same question to multiple AIs and compare responses
 */
export function createComparisonFlow(
  providers: Array<{ provider: string; model: string }> = [
    { provider: 'openai', model: 'gpt-4' },
    { provider: 'anthropic', model: 'claude-3-opus-20240229' },
    { provider: 'google', model: 'gemini-pro' },
  ]
): FlowDefinition {
  return {
    name: 'Multi-Provider Comparison',
    description: 'Get answers from multiple AI providers and compare results',
    type: OrchestrationFlowType.PARALLEL,
    steps: [
      ...providers.map((config, index) => ({
        id: `provider_${index}`,
        provider: config.provider,
        model: config.model,
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: {
          temperature: 0.7,
          maxTokens: 1500,
        },
      })),
      {
        id: 'analyze_compare',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.COMPARE,
        prompt: (context: StepContext) => {
          const responses = context.allStepResults
            .filter((r) => r.stepId.startsWith('provider_'))
            .map((r, i) => `\n### Response ${i + 1} (${r.provider} - ${r.model})\n${r.output}`)
            .join('\n\n');

          return `Compare and analyze the following AI responses to the same prompt. Identify:
1. Common themes and agreements
2. Unique insights from each response
3. Areas of disagreement
4. Overall quality assessment

${responses}

Provide a comprehensive comparison and synthesized recommendation.`;
        },
        inputFrom: 'all',
        settings: {
          temperature: 0.3,
          maxTokens: 2000,
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
}

/**
 * Iterative Refinement Flow Template
 * Generate, evaluate, refine in a loop until quality threshold is met
 */
export function createRefinementFlow(
  maxIterations: number = 3,
  qualityThreshold: number = 0.8
): FlowDefinition {
  let iteration = 0;

  return {
    name: 'Iterative Refinement',
    description: 'Continuously refine content until quality threshold is met',
    type: OrchestrationFlowType.REFINEMENT,
    steps: [
      {
        id: 'generate',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
      {
        id: 'evaluate',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.EVALUATE,
        prompt: (context: StepContext) => {
          const content = context.previousStepOutput || '';
          return `Evaluate the following content on a scale of 0.0 to 1.0 based on:
- Clarity and coherence
- Completeness
- Accuracy
- Professional quality

Content:
${content}

Provide:
1. Overall score (0.0 to 1.0)
2. Specific areas needing improvement
3. Suggestions for enhancement

Format: Start with "SCORE: X.XX" followed by detailed feedback.`;
        },
        inputFrom: 'previous',
        settings: {
          temperature: 0.2,
          maxTokens: 1000,
        },
        condition: (context: StepContext) => {
          return iteration < maxIterations;
        },
      },
      {
        id: 'refine',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.REFINE,
        prompt: (context: StepContext) => {
          const original = context.previousStepOutputs['generate'] || '';
          const evaluation = context.previousStepOutput || '';

          // Extract score from evaluation
          const scoreMatch = evaluation.match(/SCORE:\s*([\d.]+)/i);
          const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

          if (score >= qualityThreshold) {
            return ''; // Don't refine if quality is good enough
          }

          iteration++;
          return `Improve the following content based on this evaluation:

ORIGINAL:
${original}

EVALUATION:
${evaluation}

Provide an enhanced version addressing the identified issues.`;
        },
        inputFrom: 'evaluate',
        settings: {
          temperature: 0.6,
          maxTokens: 2000,
        },
        condition: (context: StepContext) => {
          const evaluation = context.previousStepOutput || '';
          const scoreMatch = evaluation.match(/SCORE:\s*([\d.]+)/i);
          const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
          return score < qualityThreshold && iteration < maxIterations;
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 12000,
      includeOriginalPrompt: true,
    },
  };
}

/**
 * Sequential Analysis Flow Template
 * Multi-stage analysis with different AIs specializing in different aspects
 */
export function createSequentialAnalysisFlow(): FlowDefinition {
  return {
    name: 'Sequential Multi-Perspective Analysis',
    description: 'Different AIs analyze different aspects sequentially',
    type: OrchestrationFlowType.SEQUENTIAL,
    steps: [
      {
        id: 'extract_facts',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.EXTRACT,
        prompt: (context: StepContext) => {
          return `Extract all factual claims and key information from the following:

${context.originalPrompt}

List each fact clearly and concisely.`;
        },
        settings: {
          temperature: 0.1,
          maxTokens: 1500,
        },
      },
      {
        id: 'analyze_logic',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.ANALYZE,
        prompt: (context: StepContext) => {
          const facts = context.previousStepOutput || '';
          return `Analyze the logical structure and reasoning in these extracted facts:

${facts}

Identify:
1. Logical flow and structure
2. Assumptions and implications
3. Potential gaps or inconsistencies
4. Strength of arguments`;
        },
        inputFrom: 'extract_facts',
        settings: {
          temperature: 0.3,
          maxTokens: 1500,
        },
      },
      {
        id: 'evaluate_credibility',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.EVALUATE,
        prompt: (context: StepContext) => {
          const facts = context.previousStepOutputs['extract_facts'] || '';
          const analysis = context.previousStepOutput || '';
          return `Evaluate the credibility and reliability of the information:

FACTS:
${facts}

LOGICAL ANALYSIS:
${analysis}

Assess:
1. Source reliability (if mentioned)
2. Verifiability of claims
3. Potential biases
4. Overall credibility score (0-100)`;
        },
        inputFrom: 'analyze_logic',
        settings: {
          temperature: 0.2,
          maxTokens: 1500,
        },
      },
      {
        id: 'synthesize',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.SUMMARIZE,
        prompt: (context: StepContext) => {
          const facts = context.previousStepOutputs['extract_facts'] || '';
          const logic = context.previousStepOutputs['analyze_logic'] || '';
          const credibility = context.previousStepOutput || '';
          return `Synthesize a comprehensive analysis combining:

EXTRACTED FACTS:
${facts}

LOGICAL ANALYSIS:
${logic}

CREDIBILITY EVALUATION:
${credibility}

Provide a clear, actionable summary with key takeaways and recommendations.`;
        },
        inputFrom: 'all',
        settings: {
          temperature: 0.4,
          maxTokens: 2000,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 15000,
      includeOriginalPrompt: true,
    },
  };
}

/**
 * Conditional Expert Routing Flow Template
 * Route to different expert AIs based on content type/complexity
 */
export function createConditionalRoutingFlow(): FlowDefinition {
  return {
    name: 'Smart Expert Routing',
    description: 'Route to specialized AIs based on content analysis',
    type: OrchestrationFlowType.CONDITIONAL,
    steps: [
      {
        id: 'classify',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.ANALYZE,
        prompt: (context: StepContext) => {
          return `Classify the following request into ONE category:
- TECHNICAL (code, programming, technical documentation)
- CREATIVE (writing, storytelling, creative content)
- ANALYTICAL (data analysis, research, logical reasoning)
- GENERAL (everything else)

Request: ${context.originalPrompt}

Respond with ONLY the category name.`;
        },
        settings: {
          temperature: 0.1,
          maxTokens: 50,
        },
      },
      {
        id: 'technical_expert',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: (context: StepContext) => {
          return `As a technical expert, provide a detailed, accurate response to:

${context.originalPrompt}

Include code examples, best practices, and technical details.`;
        },
        condition: (context: StepContext) => {
          const classification = context.previousStepOutput?.toUpperCase() || '';
          return classification.includes('TECHNICAL');
        },
        settings: {
          temperature: 0.3,
          maxTokens: 2500,
        },
      },
      {
        id: 'creative_expert',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.GENERATE,
        prompt: (context: StepContext) => {
          return `As a creative writing expert, craft an engaging response to:

${context.originalPrompt}

Use vivid language, compelling narratives, and creative expression.`;
        },
        condition: (context: StepContext) => {
          const classification = context.previousStepOutput?.toUpperCase() || '';
          return classification.includes('CREATIVE');
        },
        settings: {
          temperature: 0.8,
          maxTokens: 2500,
        },
      },
      {
        id: 'analytical_expert',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.ANALYZE,
        prompt: (context: StepContext) => {
          return `As an analytical expert, provide a thorough, data-driven response to:

${context.originalPrompt}

Include structured analysis, evidence, and logical reasoning.`;
        },
        condition: (context: StepContext) => {
          const classification = context.previousStepOutput?.toUpperCase() || '';
          return classification.includes('ANALYTICAL');
        },
        settings: {
          temperature: 0.2,
          maxTokens: 2500,
        },
      },
      {
        id: 'general_expert',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        condition: (context: StepContext) => {
          const classification = context.previousStepOutput?.toUpperCase() || '';
          return classification.includes('GENERAL');
        },
        settings: {
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: true,
      shareStepOutputs: false,
      maxSharedTokens: 8000,
      includeOriginalPrompt: true,
    },
  };
}

/**
 * Consensus Building Flow Template
 * Multiple AIs generate solutions, then collaborate to build consensus
 */
export function createConsensusFlow(): FlowDefinition {
  return {
    name: 'Multi-AI Consensus Building',
    description: 'Multiple AIs propose solutions, then build consensus',
    type: OrchestrationFlowType.PARALLEL,
    steps: [
      {
        id: 'proposal_gpt4',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: { temperature: 0.7, maxTokens: 1500 },
      },
      {
        id: 'proposal_claude',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: { temperature: 0.7, maxTokens: 1500 },
      },
      {
        id: 'proposal_gemini',
        provider: 'google',
        model: 'gemini-pro',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: { temperature: 0.7, maxTokens: 1500 },
      },
      {
        id: 'build_consensus',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.SUMMARIZE,
        prompt: (context: StepContext) => {
          const proposals = context.allStepResults
            .filter((r) => r.stepId.startsWith('proposal_'))
            .map((r, i) => `\n### Proposal ${i + 1} (${r.model})\n${r.output}`)
            .join('\n\n');

          return `Review these independent proposals and build a consensus solution:

${proposals}

Create a unified response that:
1. Incorporates the best elements from each proposal
2. Resolves any conflicts or contradictions
3. Provides a coherent, comprehensive solution
4. Notes any remaining areas of uncertainty`;
        },
        inputFrom: 'all',
        settings: {
          temperature: 0.4,
          maxTokens: 2500,
        },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 12000,
      includeOriginalPrompt: true,
    },
  };
}

/**
 * Quality Assurance Flow Template
 * Generate content, then multiple specialized reviewers check different aspects
 */
export function createQualityAssuranceFlow(): FlowDefinition {
  return {
    name: 'Multi-Stage Quality Assurance',
    description: 'Generate content with multiple specialized quality checks',
    type: OrchestrationFlowType.SEQUENTIAL,
    steps: [
      {
        id: 'generate',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.GENERATE,
        prompt: 'original',
        settings: { temperature: 0.7, maxTokens: 2000 },
      },
      {
        id: 'check_accuracy',
        provider: 'openai',
        model: 'gpt-4',
        action: StepAction.VALIDATE,
        prompt: (context: StepContext) => {
          return `Review this content for factual accuracy and correctness:

${context.previousStepOutput}

Check for:
1. Factual errors or inaccuracies
2. Outdated information
3. Unsubstantiated claims
4. Logical inconsistencies

Provide: PASS/FAIL and list any issues found.`;
        },
        settings: { temperature: 0.1, maxTokens: 1000 },
      },
      {
        id: 'check_clarity',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.VALIDATE,
        prompt: (context: StepContext) => {
          const content = context.previousStepOutputs['generate'] || '';
          return `Review this content for clarity and readability:

${content}

Check for:
1. Clear, concise language
2. Logical structure and flow
3. Appropriate level of detail
4. Absence of jargon or ambiguity

Provide: PASS/FAIL and suggestions for improvement.`;
        },
        settings: { temperature: 0.2, maxTokens: 1000 },
      },
      {
        id: 'final_verdict',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        action: StepAction.EVALUATE,
        prompt: (context: StepContext) => {
          const original = context.previousStepOutputs['generate'] || '';
          const accuracy = context.previousStepOutputs['check_accuracy'] || '';
          const clarity = context.previousStepOutput || '';

          return `Provide final quality verdict based on these reviews:

ORIGINAL CONTENT:
${original}

ACCURACY REVIEW:
${accuracy}

CLARITY REVIEW:
${clarity}

Final verdict:
1. Overall quality score (0-100)
2. Whether content is ready for use (YES/NO)
3. Required fixes if any
4. Summary of strengths and weaknesses`;
        },
        settings: { temperature: 0.3, maxTokens: 1500 },
      },
    ],
    contextPolicy: {
      shareConversationHistory: false,
      shareStepOutputs: true,
      maxSharedTokens: 15000,
      includeOriginalPrompt: false,
    },
  };
}

/**
 * Template Registry
 */
export const flowTemplates = {
  critique: createCritiqueFlow,
  comparison: createComparisonFlow,
  refinement: createRefinementFlow,
  analysis: createSequentialAnalysisFlow,
  routing: createConditionalRoutingFlow,
  consensus: createConsensusFlow,
  qa: createQualityAssuranceFlow,
};

/**
 * Get template by name
 */
export function getFlowTemplate(
  name: keyof typeof flowTemplates,
  ...args: any[]
): FlowDefinition {
  const templateFn = flowTemplates[name];
  if (!templateFn) {
    throw new Error(`Flow template not found: ${name}`);
  }
  return templateFn(...args);
}

/**
 * List all available templates
 */
export function listFlowTemplates(): Array<{ name: string; description: string }> {
  return [
    {
      name: 'critique',
      description: 'One AI generates, another critiques, then refinement',
    },
    {
      name: 'comparison',
      description: 'Compare responses from multiple AI providers',
    },
    {
      name: 'refinement',
      description: 'Iteratively refine content until quality threshold met',
    },
    {
      name: 'analysis',
      description: 'Multi-stage analysis with specialized perspectives',
    },
    {
      name: 'routing',
      description: 'Route to specialized experts based on content type',
    },
    {
      name: 'consensus',
      description: 'Multiple AIs propose solutions and build consensus',
    },
    {
      name: 'qa',
      description: 'Generate content with multi-stage quality assurance',
    },
  ];
}
