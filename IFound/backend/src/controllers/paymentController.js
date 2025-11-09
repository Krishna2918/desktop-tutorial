const paymentService = require('../services/paymentService');
const { Transaction, Case, User } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Create bounty payment intent
// @route   POST /api/v1/payments/bounty
// @access  Private
const createBountyPayment = asyncHandler(async (req, res) => {
  const { case_id } = req.body;

  const caseData = await Case.findByPk(case_id);

  if (!caseData) {
    return res.status(404).json({
      success: false,
      message: 'Case not found',
    });
  }

  // Check if user is the poster
  if (caseData.poster_id !== req.userId) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const paymentIntent = await paymentService.createBountyPayment(caseData, req.userId);

  // Create transaction record
  const transaction = await Transaction.create({
    case_id: caseData.id,
    poster_id: req.userId,
    transaction_type: 'bounty_payment',
    amount: caseData.bounty_amount,
    platform_commission: caseData.platform_commission,
    status: 'pending',
    stripe_payment_intent_id: paymentIntent.id,
  });

  res.status(201).json({
    success: true,
    message: 'Payment intent created',
    data: {
      payment_intent: paymentIntent,
      transaction,
    },
  });
});

// @desc    Release bounty to finder
// @route   POST /api/v1/payments/release/:transactionId
// @access  Private (poster or admin)
const releaseBounty = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findByPk(transactionId, {
    include: [{ model: Case, as: 'case' }],
  });

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Check authorization
  if (transaction.poster_id !== req.userId && req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const transfer = await paymentService.releaseBountyToFinder(transactionId);

  res.status(200).json({
    success: true,
    message: 'Bounty released to finder',
    data: { transfer },
  });
});

// @desc    Refund payment
// @route   POST /api/v1/payments/refund/:transactionId
// @access  Private (poster or admin)
const refundPayment = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { reason } = req.body;

  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    });
  }

  // Check authorization
  if (transaction.poster_id !== req.userId && req.user.user_type !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized',
    });
  }

  const refund = await paymentService.refundPayment(transactionId, reason);

  res.status(200).json({
    success: true,
    message: 'Payment refunded',
    data: { refund },
  });
});

// @desc    Get transaction history
// @route   GET /api/v1/payments/history
// @access  Private
const getTransactionHistory = asyncHandler(async (req, res) => {
  const { page, limit, type } = req.query;

  const result = await paymentService.getTransactionHistory(req.userId, {
    page,
    limit,
    type,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

// @desc    Get user balance
// @route   GET /api/v1/payments/balance
// @access  Private
const getUserBalance = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.userId);

  // Calculate pending earnings
  const pendingTransactions = await Transaction.findAll({
    where: {
      finder_id: req.userId,
      status: 'escrow',
    },
  });

  const pendingEarnings = pendingTransactions.reduce(
    (sum, t) => sum + parseFloat(t.net_amount),
    0
  );

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: parseFloat(user.total_earnings),
      pendingEarnings,
      availableBalance: parseFloat(user.total_earnings) - pendingEarnings,
    },
  });
});

module.exports = {
  createBountyPayment,
  releaseBounty,
  refundPayment,
  getTransactionHistory,
  getUserBalance,
};
