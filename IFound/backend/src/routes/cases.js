const express = require('express');
const router = express.Router();
const {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  deleteCase,
  getMyCases,
} = require('../controllers/caseController');
const {
  authenticateToken,
  optionalAuth,
  requireVerification,
} = require('../middleware/auth');

// Public routes
router.get('/', optionalAuth, getCases);
router.get('/:id', optionalAuth, getCaseById);

// Protected routes
router.post(
  '/',
  authenticateToken,
  requireVerification('email_verified'),
  createCase
);
router.get('/my/cases', authenticateToken, getMyCases);
router.put('/:id', authenticateToken, updateCase);
router.delete('/:id', authenticateToken, deleteCase);

module.exports = router;
