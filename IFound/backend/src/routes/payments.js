const express = require('express');
const router = express.Router();
const {
  createBountyPayment,
  releaseBounty,
  refundPayment,
  getTransactionHistory,
  getUserBalance,
} = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// All payment routes require authentication
router.use(authenticateToken);

router.post('/bounty', createBountyPayment);
router.post('/release/:transactionId', releaseBounty);
router.post('/refund/:transactionId', refundPayment);
router.get('/history', getTransactionHistory);
router.get('/balance', getUserBalance);

module.exports = router;
