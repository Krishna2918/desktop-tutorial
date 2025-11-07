const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const { Transaction, User } = require('../models');

class PaymentService {
  /**
   * Create payment intent for bounty (escrow)
   */
  async createBountyPayment(caseData, posterId) {
    try {
      const amount = parseFloat(caseData.bounty_amount) * 100; // Convert to cents

      // In test mode, create a mock payment intent
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
        return {
          id: `pi_test_${Date.now()}`,
          amount: amount,
          currency: 'usd',
          status: 'succeeded',
          test_mode: true,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: 'usd',
        metadata: {
          case_id: caseData.id,
          poster_id: posterId,
        },
        description: `Bounty for case: ${caseData.title}`,
      });

      return paymentIntent;
    } catch (error) {
      console.error('Payment creation error:', error);
      throw new Error('Failed to create payment');
    }
  }

  /**
   * Release bounty payment to finder
   */
  async releaseBountyToFinder(transactionId) {
    try {
      const transaction = await Transaction.findByPk(transactionId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'escrow') {
        throw new Error('Transaction not in escrow status');
      }

      // In test mode, simulate transfer
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
        transaction.status = 'completed';
        transaction.completed_at = new Date();
        await transaction.save();

        return {
          id: `tr_test_${Date.now()}`,
          amount: transaction.net_amount * 100,
          status: 'paid',
          test_mode: true,
        };
      }

      // Get finder's Stripe account
      const finder = await User.findByPk(transaction.finder_id);

      if (!finder.stripe_account_id) {
        throw new Error('Finder does not have a connected Stripe account');
      }

      // Create transfer to finder
      const transfer = await stripe.transfers.create({
        amount: Math.round(parseFloat(transaction.net_amount) * 100),
        currency: 'usd',
        destination: finder.stripe_account_id,
        metadata: {
          transaction_id: transactionId,
          case_id: transaction.case_id,
        },
      });

      // Update transaction
      transaction.stripe_transfer_id = transfer.id;
      transaction.status = 'completed';
      transaction.completed_at = new Date();
      await transaction.save();

      return transfer;
    } catch (error) {
      console.error('Transfer error:', error);

      // Update transaction as failed
      const transaction = await Transaction.findByPk(transactionId);
      if (transaction) {
        transaction.status = 'failed';
        transaction.failed_at = new Date();
        transaction.failure_reason = error.message;
        await transaction.save();
      }

      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(transactionId, reason) {
    try {
      const transaction = await Transaction.findByPk(transactionId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // In test mode, simulate refund
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
        transaction.status = 'refunded';
        transaction.refunded_at = new Date();
        transaction.refund_reason = reason;
        await transaction.save();

        return {
          id: `re_test_${Date.now()}`,
          amount: transaction.amount * 100,
          status: 'succeeded',
          test_mode: true,
        };
      }

      if (!transaction.stripe_payment_intent_id) {
        throw new Error('No payment intent found for this transaction');
      }

      // Create refund
      const refund = await stripe.refunds.create({
        payment_intent: transaction.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          transaction_id: transactionId,
          custom_reason: reason,
        },
      });

      // Update transaction
      transaction.status = 'refunded';
      transaction.refunded_at = new Date();
      transaction.refund_reason = reason;
      await transaction.save();

      return refund;
    } catch (error) {
      console.error('Refund error:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    const { page = 1, limit = 20, type } = options;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      [sequelize.Sequelize.Op.or]: [
        { finder_id: userId },
        { poster_id: userId },
      ],
    };

    if (type) {
      where.transaction_type = type;
    }

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'title', 'case_type'],
        },
      ],
    });

    return {
      transactions,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    };
  }
}

module.exports = new PaymentService();
