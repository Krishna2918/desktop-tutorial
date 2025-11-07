const express = require('express');
const router = express.Router();
const {
  getDashboardAnalytics,
  getAllUsers,
  updateUserVerification,
  suspendUser,
  getAllCasesForModeration,
  suspendCase,
  getAllSubmissions,
  getAllTransactions,
} = require('../controllers/adminController');
const { authenticateToken, requireUserType } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireUserType('admin'));

// Analytics
router.get('/analytics', getDashboardAnalytics);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/verify', updateUserVerification);
router.put('/users/:id/suspend', suspendUser);

// Cases
router.get('/cases', getAllCasesForModeration);
router.put('/cases/:id/suspend', suspendCase);

// Submissions
router.get('/submissions', getAllSubmissions);

// Transactions
router.get('/transactions', getAllTransactions);

module.exports = router;
