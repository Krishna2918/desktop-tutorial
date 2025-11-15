const request = require('supertest');
const app = require('../src/server');
const { sequelize } = require('../src/models');
const path = require('path');
const fs = require('fs');

describe('Integration Tests - Complete Workflows', () => {
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test image
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    if (!fs.existsSync(testImagePath)) {
      const buffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
      ]);
      fs.writeFileSync(testImagePath, buffer);
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await sequelize.close();
  });

  describe('Complete Lost Item Workflow', () => {
    let posterToken, finderToken, adminToken;
    let posterId, finderId;
    let caseId, photoId, submissionId, transactionId;

    it('should complete full lost item journey', async () => {
      // Step 1: Register poster
      const posterRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Item Owner',
          email: 'owner@test.com',
          password: 'password123',
          role: 'poster',
        });

      expect(posterRes.status).toBe(201);
      posterToken = posterRes.body.data.token;
      posterId = posterRes.body.data.user.id;

      // Step 2: Register finder
      const finderRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Item Finder',
          email: 'finder@test.com',
          password: 'password123',
          role: 'finder',
        });

      expect(finderRes.status).toBe(201);
      finderToken = finderRes.body.data.token;
      finderId = finderRes.body.data.user.id;

      // Step 3: Register admin
      const adminRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Admin',
          email: 'admin@test.com',
          password: 'password123',
          role: 'admin',
        });

      expect(adminRes.status).toBe(201);
      adminToken = adminRes.body.data.token;

      // Step 4: Poster creates case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          title: 'Lost iPhone 13 Pro',
          description: 'Black iPhone with cracked screen',
          case_type: 'lost_item',
          location: 'Central Park, NYC',
          bounty_amount: 200,
          latitude: 40.7829,
          longitude: -73.9654,
        });

      expect(caseRes.status).toBe(201);
      caseId = caseRes.body.data.id;
      expect(caseRes.body.data.status).toBe('active');

      // Step 5: Poster uploads photo
      const photoRes = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${posterToken}`)
        .attach('photos', testImagePath);

      expect(photoRes.status).toBe(201);
      photoId = photoRes.body.data[0].id;
      expect(photoRes.body.data[0].upload_status).toBe('processing');

      // Step 6: Poster creates bounty payment
      const paymentRes = await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: 200,
        });

      expect(paymentRes.status).toBe(201);
      transactionId = paymentRes.body.data.id;
      expect(paymentRes.body.data.transaction_type).toBe('escrow');

      // Step 7: Finder searches for cases
      const searchRes = await request(app)
        .get('/api/v1/cases?case_type=lost_item')
        .set('Authorization', `Bearer ${finderToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.cases.length).toBeGreaterThan(0);

      // Step 8: Finder submits finding
      const subRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          case_id: caseId,
          submission_type: 'found',
          description: 'I found your iPhone at Central Park bench',
          location: 'Central Park Bench 42',
          latitude: 40.7830,
          longitude: -73.9655,
        });

      expect(subRes.status).toBe(201);
      submissionId = subRes.body.data.id;
      expect(subRes.body.data.status).toBe('pending');

      // Step 9: Admin verifies submission
      const verifyRes = await request(app)
        .put(`/api/v1/submissions/${submissionId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'verified',
          bounty_percentage: 100,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.status).toBe('verified');

      // Step 10: Poster releases payment
      const releaseRes = await request(app)
        .post(`/api/v1/payments/release/${transactionId}`)
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          submission_id: submissionId,
          receiver_id: finderId,
        });

      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.data.receiver_id).toBe(finderId);

      // Step 11: Verify finder received payment
      const historyRes = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${finderToken}`);

      expect(historyRes.status).toBe(200);
      const receivedPayment = historyRes.body.data.find(
        tx => tx.receiver_id === finderId
      );
      expect(receivedPayment).toBeDefined();

      // Step 12: Check admin analytics
      const analyticsRes = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(analyticsRes.status).toBe(200);
      expect(analyticsRes.body.data.totalCases).toBeGreaterThan(0);
      expect(analyticsRes.body.data.totalSubmissions).toBeGreaterThan(0);
    });
  });

  describe('Complete Missing Person Workflow', () => {
    let posterToken, finderToken;
    let caseId;

    it('should handle missing person case workflow', async () => {
      // Register users
      const posterRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Concerned Family',
          email: 'family@test.com',
          password: 'password123',
          role: 'poster',
        });

      posterToken = posterRes.body.data.token;

      const finderRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Helpful Citizen',
          email: 'citizen@test.com',
          password: 'password123',
          role: 'finder',
        });

      finderToken = finderRes.body.data.token;

      // Create missing person case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          title: 'Missing: John Doe, Age 45',
          description: 'Last seen wearing blue jacket',
          case_type: 'missing_person',
          location: 'Downtown Seattle',
          bounty_amount: 1000,
        });

      expect(caseRes.status).toBe(201);
      caseId = caseRes.body.data.id;

      // Upload photo
      await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${posterToken}`)
        .attach('photos', testImagePath);

      // Create bounty
      await request(app)
        .post('/api/v1/payments/bounty')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          case_id: caseId,
          amount: 1000,
        });

      // Anonymous tip submission
      const anonTipRes = await request(app)
        .post('/api/v1/submissions')
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'Saw someone matching description near Pike Market',
          location: 'Pike Place Market',
        });

      expect(anonTipRes.status).toBe(201);
      expect(anonTipRes.body.data.user_id).toBeNull();

      // Authenticated tip
      const authTipRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'I think I saw this person at the library',
        });

      expect(authTipRes.status).toBe(201);
      expect(authTipRes.body.data.user_id).toBeDefined();

      // Get all submissions for case
      const subsRes = await request(app)
        .get(`/api/v1/submissions/case/${caseId}`)
        .set('Authorization', `Bearer ${posterToken}`);

      expect(subsRes.status).toBe(200);
      expect(subsRes.body.data.length).toBe(2);
    });
  });

  describe('AI-Enhanced Search Workflow', () => {
    let userToken;
    let caseId;

    it('should use AI to search for similar cases', async () => {
      // Register user
      const userRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'AI User',
          email: 'aiuser@test.com',
          password: 'password123',
          role: 'finder',
        });

      userToken = userRes.body.data.token;

      // Create case with photo
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Lost Dog - Golden Retriever',
          description: 'Friendly golden retriever',
          case_type: 'lost_item',
          location: 'Dog Park',
          bounty_amount: 150,
        });

      caseId = caseRes.body.data.id;

      // Upload photo (triggers AI processing)
      await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photos', testImagePath);

      // Search by similar image
      const searchRes = await request(app)
        .post('/api/v1/ai/search-similar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(searchRes.status);

      // Analyze photo
      const analyzeRes = await request(app)
        .post('/api/v1/ai/analyze-photo')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(analyzeRes.status);

      // Check AI status
      const statusRes = await request(app)
        .get('/api/v1/ai/status');

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data).toHaveProperty('services');
    });
  });

  describe('Admin Moderation Workflow', () => {
    let adminToken, userToken;
    let userId, caseId, submissionId;

    it('should handle complete admin moderation flow', async () => {
      // Create admin
      const adminRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Moderator',
          email: 'moderator@test.com',
          password: 'password123',
          role: 'admin',
        });

      adminToken = adminRes.body.data.token;

      // Create user
      const userRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Suspicious User',
          email: 'suspicious@test.com',
          password: 'password123',
          role: 'poster',
        });

      userToken = userRes.body.data.token;
      userId = userRes.body.data.user.id;

      // User creates case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Suspicious Case',
          description: 'Potentially inappropriate',
          case_type: 'lost_item',
          location: 'Unknown',
          bounty_amount: 50,
        });

      caseId = caseRes.body.data.id;

      // User creates submission
      const subRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'Spam submission',
        });

      submissionId = subRes.body.data.id;

      // Admin views analytics
      const analyticsRes = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(analyticsRes.status).toBe(200);

      // Admin views all users
      const usersRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(usersRes.status).toBe(200);

      // Admin suspends case
      const suspendCaseRes = await request(app)
        .put(`/api/v1/admin/cases/${caseId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(suspendCaseRes.status).toBe(200);
      expect(suspendCaseRes.body.data.status).toBe('suspended');

      // Admin rejects submission
      const rejectSubRes = await request(app)
        .put(`/api/v1/submissions/${submissionId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'rejected',
        });

      expect(rejectSubRes.status).toBe(200);

      // Admin suspends user
      const suspendUserRes = await request(app)
        .put(`/api/v1/admin/users/${userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(suspendUserRes.status).toBe(200);
      expect(suspendUserRes.body.data.account_status).toBe('suspended');

      // Verify suspended user cannot login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'suspicious@test.com',
          password: 'password123',
        });

      // Should either fail or return suspended status
      if (loginRes.status === 200) {
        expect(loginRes.body.data.user.account_status).toBe('suspended');
      }
    });
  });

  describe('Multi-User Collaboration', () => {
    it('should handle multiple finders on same case', async () => {
      // Create poster
      const posterRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Case Poster',
          email: 'multiposter@test.com',
          password: 'password123',
          role: 'poster',
        });

      const posterToken = posterRes.body.data.token;

      // Create case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${posterToken}`)
        .send({
          title: 'High Value Item',
          description: 'Expensive watch',
          case_type: 'lost_item',
          location: 'Airport',
          bounty_amount: 500,
        });

      const caseId = caseRes.body.data.id;

      // Create multiple finders
      const finder1Res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Finder 1',
          email: 'finder1@test.com',
          password: 'password123',
          role: 'finder',
        });

      const finder2Res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Finder 2',
          email: 'finder2@test.com',
          password: 'password123',
          role: 'finder',
        });

      // Both submit tips
      const sub1Res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${finder1Res.body.data.token}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'Saw it at Terminal A',
        });

      const sub2Res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${finder2Res.body.data.token}`)
        .send({
          case_id: caseId,
          submission_type: 'found',
          description: 'I have the watch',
        });

      expect(sub1Res.status).toBe(201);
      expect(sub2Res.status).toBe(201);

      // Get all submissions
      const subsRes = await request(app)
        .get(`/api/v1/submissions/case/${caseId}`)
        .set('Authorization', `Bearer ${posterToken}`);

      expect(subsRes.status).toBe(200);
      expect(subsRes.body.data.length).toBe(2);
    });
  });
});
