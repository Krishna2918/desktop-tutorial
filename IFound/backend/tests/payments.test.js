const request = require('supertest');
const app = require('../src/server');
const { sequelize, Transaction } = require('../src/models');

describe('Payment Endpoints', () => {
  let posterToken, finderToken;
  let posterId, finderId;
  let caseId, submissionId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create poster user
    const posterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Poster User',
        email: 'poster@test.com',
        password: 'password123',
        role: 'poster',
      });

    posterToken = posterRes.body.data.token;
    posterId = posterRes.body.data.user.id;

    // Create finder user
    const finderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Finder User',
        email: 'finder@test.com',
        password: 'password123',
        role: 'finder',
      });

    finderToken = finderRes.body.data.token;
    finderId = finderRes.body.data.user.id;

    // Create case
    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${posterToken}`)
      .send({
        title: 'Lost Wallet',
        description: 'Brown leather wallet',
        case_type: 'lost_item',
        location: 'Mall',
        bounty_amount: 500,
      });

    caseId = caseRes.body.data.id;

    // Create submission
    const subRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${finderToken}`)
      .send({
        case_id: caseId,
        submission_type: 'sighting',
        description: 'Found it',
      });

    submissionId = subRes.body.data.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v1/payments/bounty', () => {
    it('should create bounty payment (escrow)', async () => {
      const res = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.transaction_type).toBe('escrow');
      expect(parseFloat(res.body.data.amount)).toBe(500);
      expect(res.body.data.status).toBe('completed');
    });

    it('should fail with invalid amount', async () => {
      const res = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: -100, // negative amount
        });

      expect(res.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/payments/bounty')
        .send({
          case_id: caseId,
          amount: 500,
        });

      expect(res.status).toBe(401);
    });

    it('should fail for non-existent case', async () => {
      const res = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: 99999,
          amount: 500,
        });

      expect(res.status).toBe(404);
    });

    it('should fail for case not owned by user', async () => {
      const res = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          case_id: caseId,
          amount: 500,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/payments/release/:transactionId', () => {
    let transactionId;

    beforeEach(async () => {
      // Create escrow transaction
      const paymentRes = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: 500,
        });

      transactionId = paymentRes.body.data.id;
    });

    it('should release payment to finder', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/release/${transactionId}`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          submission_id: submissionId,
          receiver_id: finderId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction_type).toBe('release');
      expect(res.body.data.receiver_id).toBe(finderId);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/release/${transactionId}`)
        .send({
          submission_id: submissionId,
          receiver_id: finderId,
        });

      expect(res.status).toBe(401);
    });

    it('should fail for non-existent transaction', async () => {
      const res = await request(app)
        .post('/api/v1/payments/release/99999')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          submission_id: submissionId,
          receiver_id: finderId,
        });

      expect(res.status).toBe(404);
    });

    it('should fail if not transaction owner', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/release/${transactionId}`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          submission_id: submissionId,
          receiver_id: finderId,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/payments/refund/:transactionId', () => {
    let transactionId;

    beforeEach(async () => {
      const paymentRes = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: 500,
        });

      transactionId = paymentRes.body.data.id;
    });

    it('should refund payment', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/refund/${transactionId}`)
        .set('Authorization', `Bearer ${posterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction_type).toBe('refund');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/refund/${transactionId}`);

      expect(res.status).toBe(401);
    });

    it('should fail if not transaction owner', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/refund/${transactionId}`)
        .set('Authorization', `Bearer ${finderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/payments/history', () => {
    it('should get payment history for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${posterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/payments/history');

      expect(res.status).toBe(401);
    });

    it('should filter by transaction type', async () => {
      const res = await request(app)
        .get('/api/v1/payments/history?type=escrow')
        .set('Authorization', `Bearer ${posterToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(transaction => {
        expect(transaction.transaction_type).toBe('escrow');
      });
    });
  });

  describe('GET /api/v1/payments/balance', () => {
    it('should get user balance', async () => {
      const res = await request(app)
        .get('/api/v1/payments/balance')
        .set('Authorization', `Bearer ${posterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('balance');
      expect(typeof res.body.data.balance).toBe('number');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/payments/balance');

      expect(res.status).toBe(401);
    });

    it('should have correct balance calculation', async () => {
      // Create fresh user
      const newUserRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Balance Test User',
          email: 'balance@test.com',
          password: 'password123',
          role: 'poster',
        });

      const newToken = newUserRes.body.data.token;

      const res = await request(app)
        .get('/api/v1/payments/balance')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(0);
    });
  });

  describe('Payment Integration', () => {
    it('should handle complete payment flow', async () => {
      // 1. Create case with bounty
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          title: 'Integration Test Case',
          description: 'Full flow test',
          case_type: 'lost_item',
          location: 'Park',
          bounty_amount: 300,
        });

      expect(caseRes.status).toBe(201);
      const newCaseId = caseRes.body.data.id;

      // 2. Create escrow payment
      const escrowRes = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: newCaseId,
          amount: 300,
        });

      expect(escrowRes.status).toBe(201);
      const escrowTxId = escrowRes.body.data.id;

      // 3. Create submission
      const subRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          case_id: newCaseId,
          submission_type: 'found',
          description: 'I found it!',
        });

      expect(subRes.status).toBe(201);
      const newSubId = subRes.body.data.id;

      // 4. Release payment
      const releaseRes = await request(app)
        .post(`/api/v1/payments/release/${escrowTxId}`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          submission_id: newSubId,
          receiver_id: finderId,
        });

      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.data.status).toBe('completed');

      // 5. Verify transaction history
      const historyRes = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${finderToken}`);

      expect(historyRes.status).toBe(200);
      const receivedPayments = historyRes.body.data.filter(
        tx => tx.receiver_id === finderId
      );
      expect(receivedPayments.length).toBeGreaterThan(0);
    });
  });
});
