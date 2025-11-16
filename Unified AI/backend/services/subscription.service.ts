import { Repository } from 'typeorm';
import { SubscriptionPlan, PlanType, SubscriptionStatus, BillingInterval } from '../entities/SubscriptionPlan';
import { Invoice, InvoiceStatus } from '../entities/Invoice';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { AppDataSource } from '../config/data-source';
import { auditService } from './audit.service';
import { AuditAction } from '../entities/AuditLog';

export interface SubscriptionPlanDetails {
  planType: PlanType;
  name: string;
  description: string;
  pricing: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: string[];
  limits: {
    messagesPerMonth: number;
    tokensPerMonth: number;
    conversationsPerMonth: number;
    documentsPerUser: number;
    documentSizeMB: number;
    totalStorageMB: number;
  };
}

export interface SubscribeInput {
  userId?: string;
  organizationId?: string;
  planType: PlanType;
  billingInterval: BillingInterval;
  paymentMethod: {
    type: 'card' | 'bank_account';
    token: string;
  };
  trialDays?: number;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: any;
  };
  created: number;
}

/**
 * Subscription Service - Subscription and billing management
 *
 * Manages the complete subscription lifecycle:
 * - Plan selection and subscription creation
 * - Payment processing (Stripe integration)
 * - Plan upgrades and downgrades
 * - Cancellations and refunds
 * - Invoice generation and retrieval
 * - Webhook handling for payment events
 */
export class SubscriptionService {
  private subscriptionRepository: Repository<SubscriptionPlan>;
  private invoiceRepository: Repository<Invoice>;
  private userRepository: Repository<User>;
  private organizationRepository: Repository<Organization>;

  // Stripe configuration (from environment)
  private readonly stripeApiKey: string;
  private readonly stripeWebhookSecret: string;

  // Available plans with pricing
  private readonly availablePlans: Record<PlanType, SubscriptionPlanDetails> = {
    [PlanType.FREE]: {
      planType: PlanType.FREE,
      name: 'Free',
      description: 'Perfect for trying out Unified AI Hub',
      pricing: {
        monthly: 0,
        yearly: 0,
        currency: 'USD'
      },
      features: [
        'Basic chat functionality',
        'Limited AI provider access',
        '50 messages per month',
        '100MB storage',
        'Email support'
      ],
      limits: {
        messagesPerMonth: 50,
        tokensPerMonth: 100000,
        conversationsPerMonth: 10,
        documentsPerUser: 10,
        documentSizeMB: 5,
        totalStorageMB: 100
      }
    },
    [PlanType.INDIVIDUAL_BASIC]: {
      planType: PlanType.INDIVIDUAL_BASIC,
      name: 'Individual Basic',
      description: 'For individual users who need more',
      pricing: {
        monthly: 9.99,
        yearly: 99.99,
        currency: 'USD'
      },
      features: [
        'Advanced chat features',
        'Multiple AI providers',
        '500 messages per month',
        '1GB storage',
        'Priority email support',
        'Advanced search',
        'Export to PDF/MD'
      ],
      limits: {
        messagesPerMonth: 500,
        tokensPerMonth: 2000000,
        conversationsPerMonth: 100,
        documentsPerUser: 100,
        documentSizeMB: 25,
        totalStorageMB: 1024
      }
    },
    [PlanType.INDIVIDUAL_PRO]: {
      planType: PlanType.INDIVIDUAL_PRO,
      name: 'Individual Pro',
      description: 'Full power for advanced individual users',
      pricing: {
        monthly: 29.99,
        yearly: 299.99,
        currency: 'USD'
      },
      features: [
        'Unlimited messages',
        'All AI providers',
        'Advanced workflows',
        '10GB storage',
        'Priority support',
        'API access',
        'Custom prompts & templates',
        'Advanced analytics'
      ],
      limits: {
        messagesPerMonth: -1,
        tokensPerMonth: 10000000,
        conversationsPerMonth: -1,
        documentsPerUser: 1000,
        documentSizeMB: 100,
        totalStorageMB: 10240
      }
    },
    [PlanType.TEAM]: {
      planType: PlanType.TEAM,
      name: 'Team',
      description: 'Collaboration tools for teams',
      pricing: {
        monthly: 49.99,
        yearly: 499.99,
        currency: 'USD'
      },
      features: [
        'Everything in Pro',
        'Team workspaces',
        'Collaboration features',
        'Team analytics',
        'RBAC',
        '50GB shared storage',
        'Up to 10 team members',
        'Dedicated support'
      ],
      limits: {
        messagesPerMonth: -1,
        tokensPerMonth: 50000000,
        conversationsPerMonth: -1,
        documentsPerUser: 5000,
        documentSizeMB: 250,
        totalStorageMB: 51200
      }
    },
    [PlanType.ENTERPRISE]: {
      planType: PlanType.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom solutions for large organizations',
      pricing: {
        monthly: 0, // Custom pricing
        yearly: 0, // Custom pricing
        currency: 'USD'
      },
      features: [
        'Everything in Team',
        'Unlimited team members',
        'Custom integrations',
        'SSO/SAML',
        'Advanced security',
        'Audit logs',
        'Custom SLA',
        'Dedicated account manager',
        'On-premise deployment',
        'Custom training'
      ],
      limits: {
        messagesPerMonth: -1,
        tokensPerMonth: -1,
        conversationsPerMonth: -1,
        documentsPerUser: -1,
        documentSizeMB: -1,
        totalStorageMB: -1
      }
    }
  };

  constructor() {
    this.subscriptionRepository = AppDataSource.getRepository(SubscriptionPlan);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
    this.userRepository = AppDataSource.getRepository(User);
    this.organizationRepository = AppDataSource.getRepository(Organization);

    // Load Stripe configuration from environment
    this.stripeApiKey = process.env.STRIPE_API_KEY || '';
    this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  /**
   * Get all available subscription plans
   */
  getAvailablePlans(): SubscriptionPlanDetails[] {
    return Object.values(this.availablePlans);
  }

  /**
   * Get details for a specific plan
   */
  getPlanDetails(planType: PlanType): SubscriptionPlanDetails {
    const plan = this.availablePlans[planType];
    if (!plan) {
      throw new Error(`Plan not found: ${planType}`);
    }
    return plan;
  }

  /**
   * Subscribe to a plan
   */
  async subscribe(input: SubscribeInput): Promise<SubscriptionPlan> {
    const {
      userId,
      organizationId,
      planType,
      billingInterval,
      paymentMethod,
      trialDays = 0
    } = input;

    // Validate input
    if (!userId && !organizationId) {
      throw new Error('Either userId or organizationId is required');
    }

    if (!planType || !billingInterval) {
      throw new Error('Plan type and billing interval are required');
    }

    // Get plan details
    const plan = this.getPlanDetails(planType);

    // Calculate amount based on billing interval
    const amount =
      billingInterval === BillingInterval.YEARLY
        ? plan.pricing.yearly
        : plan.pricing.monthly;

    // Free plan doesn't require payment
    let externalSubscriptionId: string | undefined;
    if (planType !== PlanType.FREE && amount > 0) {
      // Create Stripe subscription
      externalSubscriptionId = await this.createStripeSubscription(
        userId || organizationId!,
        planType,
        billingInterval,
        paymentMethod,
        amount,
        trialDays
      );
    }

    // Calculate period dates
    const now = new Date();
    const currentPeriodStart = new Date(now);
    const currentPeriodEnd = new Date(now);

    if (trialDays > 0) {
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + trialDays);
    } else if (billingInterval === BillingInterval.YEARLY) {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    // Calculate trial end date
    const trialEndsAt = trialDays > 0 ? new Date(now) : undefined;
    if (trialEndsAt) {
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    }

    // Create subscription
    const subscription = this.subscriptionRepository.create({
      userId,
      organizationId,
      planType,
      status: trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
      billingInterval,
      amount,
      currency: plan.pricing.currency,
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt,
      cancelAtPeriodEnd: false,
      features: plan.features,
      externalSubscriptionId
    });

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // Audit log
    await auditService.logAction({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Subscription',
      entityId: savedSubscription.id,
      metadata: {
        planType,
        billingInterval,
        amount,
        trialDays
      }
    });

    return savedSubscription;
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
    immediate: boolean = false
  ): Promise<SubscriptionPlan> {
    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }

    // Get subscription
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new Error('Subscription is already cancelled');
    }

    // Cancel Stripe subscription if exists
    if (subscription.externalSubscriptionId) {
      await this.cancelStripeSubscription(
        subscription.externalSubscriptionId,
        immediate
      );
    }

    // Update subscription
    if (immediate) {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.currentPeriodEnd = new Date();
    } else {
      subscription.cancelAtPeriodEnd = true;
    }

    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    // Audit log
    await auditService.logAction({
      userId: subscription.userId,
      action: AuditAction.UPDATE,
      entityType: 'Subscription',
      entityId: subscriptionId,
      metadata: {
        action: 'cancel',
        reason,
        immediate
      }
    });

    return updatedSubscription;
  }

  /**
   * Change subscription plan (upgrade or downgrade)
   */
  async changePlan(
    subscriptionId: string,
    newPlanType: PlanType,
    prorate: boolean = true
  ): Promise<SubscriptionPlan> {
    if (!subscriptionId || !newPlanType) {
      throw new Error('Subscription ID and new plan type are required');
    }

    // Get current subscription
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.planType === newPlanType) {
      throw new Error('Already subscribed to this plan');
    }

    // Get new plan details
    const newPlan = this.getPlanDetails(newPlanType);

    // Calculate new amount
    const newAmount =
      subscription.billingInterval === BillingInterval.YEARLY
        ? newPlan.pricing.yearly
        : newPlan.pricing.monthly;

    // Update Stripe subscription if exists
    if (subscription.externalSubscriptionId) {
      await this.updateStripeSubscription(
        subscription.externalSubscriptionId,
        newPlanType,
        newAmount,
        prorate
      );
    }

    // Update subscription
    const oldPlanType = subscription.planType;
    subscription.planType = newPlanType;
    subscription.amount = newAmount;
    subscription.features = newPlan.features;

    const updatedSubscription = await this.subscriptionRepository.save(subscription);

    // Audit log
    await auditService.logAction({
      userId: subscription.userId,
      action: AuditAction.UPDATE,
      entityType: 'Subscription',
      entityId: subscriptionId,
      metadata: {
        action: 'changePlan',
        oldPlanType,
        newPlanType,
        prorate
      }
    });

    return updatedSubscription;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: WebhookEvent): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(data.object);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(data.object);
        break;

      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }
  }

  /**
   * Get invoices for a user or organization
   */
  async getInvoices(
    userId?: string,
    organizationId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ invoices: Invoice[]; total: number }> {
    if (!userId && !organizationId) {
      throw new Error('Either userId or organizationId is required');
    }

    // Find subscriptions
    const subscriptions = await this.subscriptionRepository.find({
      where: userId ? { userId } : { organizationId },
      select: ['id']
    });

    const subscriptionIds = subscriptions.map(sub => sub.id);

    if (subscriptionIds.length === 0) {
      return { invoices: [], total: 0 };
    }

    // Get total count
    const total = await this.invoiceRepository.count({
      where: { subscriptionId: In(subscriptionIds) }
    });

    // Get invoices
    const invoices = await this.invoiceRepository.find({
      where: { subscriptionId: In(subscriptionIds) },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
      relations: ['subscription']
    });

    return { invoices, total };
  }

  /**
   * Get current subscription for user or organization
   */
  async getCurrentSubscription(
    userId?: string,
    organizationId?: string
  ): Promise<SubscriptionPlan | null> {
    if (!userId && !organizationId) {
      throw new Error('Either userId or organizationId is required');
    }

    const subscription = await this.subscriptionRepository.findOne({
      where: userId
        ? { userId, status: SubscriptionStatus.ACTIVE }
        : { organizationId, status: SubscriptionStatus.ACTIVE }
    });

    return subscription;
  }

  /**
   * Check if user has access to a feature based on their plan
   */
  async hasFeatureAccess(
    userId: string,
    feature: string
  ): Promise<boolean> {
    const subscription = await this.getCurrentSubscription(userId);

    if (!subscription) {
      // No subscription = free plan
      const freePlan = this.getPlanDetails(PlanType.FREE);
      return freePlan.features.some(f =>
        f.toLowerCase().includes(feature.toLowerCase())
      );
    }

    return subscription.features
      ? subscription.features.some(f =>
          f.toLowerCase().includes(feature.toLowerCase())
        )
      : false;
  }

  // Private helper methods for Stripe integration

  /**
   * Create Stripe subscription (mock implementation)
   * In production, use @stripe/stripe-js
   */
  private async createStripeSubscription(
    customerId: string,
    planType: PlanType,
    billingInterval: BillingInterval,
    paymentMethod: any,
    amount: number,
    trialDays: number
  ): Promise<string> {
    // Mock implementation
    // In production, create actual Stripe subscription
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Creating Stripe subscription:', {
      customerId,
      planType,
      billingInterval,
      amount,
      trialDays
    });

    return subscriptionId;
  }

  /**
   * Cancel Stripe subscription
   */
  private async cancelStripeSubscription(
    subscriptionId: string,
    immediate: boolean
  ): Promise<void> {
    // Mock implementation
    console.log('Cancelling Stripe subscription:', {
      subscriptionId,
      immediate
    });
  }

  /**
   * Update Stripe subscription
   */
  private async updateStripeSubscription(
    subscriptionId: string,
    newPlanType: PlanType,
    newAmount: number,
    prorate: boolean
  ): Promise<void> {
    // Mock implementation
    console.log('Updating Stripe subscription:', {
      subscriptionId,
      newPlanType,
      newAmount,
      prorate
    });
  }

  /**
   * Handle invoice paid webhook
   */
  private async handleInvoicePaid(invoiceData: any): Promise<void> {
    const { subscription: stripeSubId, amount_paid, currency, id, number } = invoiceData;

    // Find subscription
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubscriptionId: stripeSubId }
    });

    if (!subscription) {
      console.error('Subscription not found for invoice:', stripeSubId);
      return;
    }

    // Create or update invoice record
    const invoice = this.invoiceRepository.create({
      subscriptionId: subscription.id,
      invoiceNumber: number,
      amount: amount_paid / 100, // Stripe uses cents
      currency,
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
      externalInvoiceId: id
    });

    await this.invoiceRepository.save(invoice);

    // Update subscription status
    subscription.status = SubscriptionStatus.ACTIVE;
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Handle payment failed webhook
   */
  private async handlePaymentFailed(invoiceData: any): Promise<void> {
    const { subscription: stripeSubId } = invoiceData;

    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubscriptionId: stripeSubId }
    });

    if (!subscription) {
      return;
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.PAST_DUE;
    await this.subscriptionRepository.save(subscription);

    // In production, send notification to user
  }

  /**
   * Handle subscription updated webhook
   */
  private async handleSubscriptionUpdated(subData: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubscriptionId: subData.id }
    });

    if (!subscription) {
      return;
    }

    // Update subscription details from Stripe
    subscription.currentPeriodStart = new Date(subData.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(subData.current_period_end * 1000);

    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Handle subscription deleted webhook
   */
  private async handleSubscriptionDeleted(subData: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubscriptionId: subData.id }
    });

    if (!subscription) {
      return;
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    await this.subscriptionRepository.save(subscription);
  }

  /**
   * Handle trial will end webhook
   */
  private async handleTrialWillEnd(subData: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { externalSubscriptionId: subData.id }
    });

    if (!subscription) {
      return;
    }

    // In production, send notification to user
    console.log('Trial ending soon for subscription:', subscription.id);
  }
}

// Singleton instance
export const subscriptionService = new SubscriptionService();
