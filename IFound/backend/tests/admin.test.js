const request = require('supertest');
const app = require('../src/server');
const { sequelize } = require('../src/models');

describe('Admin Endpoints', () => {
  let adminToken, userToken;
  let adminId, userId;
  let caseId, submissionId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create admin user
    const adminRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
      });

    adminToken = adminRes.body.data.token;
    adminId = adminRes.body.data.user.id;

    // Create regular user
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Regular User',
        email: 'user@test.com',
        password: 'password123',
        role: 'poster',
      });

    userToken = userRes.body.data.token;
    userId = userRes.body.data.user.id;

    // Create test case
    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Test Case',
        description: 'For admin testing',
        case_type: 'lost_item',
        location: 'Test Location',
        bounty_amount: 100,
      });

    caseId = caseRes.body.data.id;

    // Create test submission
    const subRes = await request(app)
      .post('/api/v1/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        case_id: caseId,
        submission_type: 'sighting',
        description: 'Test submission',
      });

    submissionId = subRes.body.data.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/v1/admin/analytics', () => {
    it('should get dashboard analytics (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalCases');
      expect(res.body.data).toHaveProperty('totalSubmissions');
      expect(res.body.data).toHaveProperty('totalBountiesPaid');
      expect(res.body.data).toHaveProperty('activeCases');
      expect(res.body.data).toHaveProperty('pendingSubmissions');
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should get all users (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('totalPages');
    });

    it('should filter by role', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.users.forEach(user => {
        expect(user.role).toBe('admin');
      });
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/admin/users/:id/verify', () => {
    it('should verify user (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_verified).toBe(true);
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${userId}/verify`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should fail for non-existent user', async () => {
      const res = await request(app)
        .put('/api/v1/admin/users/99999/verify')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/users/:id/suspend', () => {
    it('should suspend user (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account_status).toBe('suspended');
    });

    it('should unsuspend user by calling suspend again', async () => {
      // First suspend
      await request(app)
        .put(`/api/v1/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Then unsuspend
      const res = await request(app)
        .put(`/api/v1/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.account_status).toBe('active');
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/cases', () => {
    it('should get all cases (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/cases')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.cases)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/cases?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('cases');
      expect(res.body.data).toHaveProperty('total');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/cases?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.cases.forEach(caseItem => {
        expect(caseItem.status).toBe('active');
      });
    });

    it('should filter by case type', async () => {
      const res = await request(app)
        .get('/api/v1/admin/cases?case_type=lost_item')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.cases.forEach(caseItem => {
        expect(caseItem.case_type).toBe('lost_item');
      });
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/cases')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/admin/cases/:id/suspend', () => {
    it('should suspend case (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/cases/${caseId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('suspended');
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/cases/${caseId}/suspend`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should fail for non-existent case', async () => {
      const res = await request(app)
        .put('/api/v1/admin/cases/99999/suspend')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/admin/submissions', () => {
    it('should get all submissions (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/submissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.submissions)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/submissions?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('submissions');
      expect(res.body.data).toHaveProperty('total');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/submissions?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.submissions.forEach(sub => {
        expect(sub.status).toBe('pending');
      });
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/submissions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/transactions', () => {
    beforeAll(async () => {
      // Create a transaction
      await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          case_id: caseId,
          amount: 100,
        });
    });

    it('should get all transactions (admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.transactions)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/admin/transactions?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('transactions');
      expect(res.body.data).toHaveProperty('total');
    });

    it('should filter by transaction type', async () => {
      const res = await request(app)
        .get('/api/v1/admin/transactions?type=escrow')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.data.transactions.forEach(tx => {
        expect(tx.transaction_type).toBe('escrow');
      });
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/transactions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Admin Authorization', () => {
    it('should block all admin routes for regular users', async () => {
      const endpoints = [
        '/api/v1/admin/analytics',
        '/api/v1/admin/users',
        '/api/v1/admin/cases',
        '/api/v1/admin/submissions',
        '/api/v1/admin/transactions',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
      }
    });

    it('should block all admin routes without authentication', async () => {
      const endpoints = [
        '/api/v1/admin/analytics',
        '/api/v1/admin/users',
        '/api/v1/admin/cases',
        '/api/v1/admin/submissions',
        '/api/v1/admin/transactions',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
      }
    });
  });
});
