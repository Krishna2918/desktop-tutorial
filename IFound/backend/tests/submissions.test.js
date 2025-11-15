const request = require('supertest');
const app = require('../src/server');
const { sequelize } = require('../src/models');

describe('Submission Endpoints', () => {
  let authToken;
  let userId;
  let caseId;
  let submissionId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test user
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Submission Test User',
        email: 'submission@test.com',
        password: 'password123',
        role: 'finder',
      });

    authToken = userRes.body.data.token;
    userId = userRes.body.data.user.id;

    // Create test case
    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Case for Submissions',
        description: 'Test description',
        case_type: 'lost_item',
        location: 'Test Location',
        bounty_amount: 200,
      });

    caseId = caseRes.body.data.id;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v1/submissions', () => {
    it('should create submission successfully (authenticated)', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'I saw this item at the park',
          location: 'Central Park',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.case_id).toBe(caseId);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.description).toBe('I saw this item at the park');

      submissionId = res.body.data.id;
    });

    it('should create anonymous submission', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .send({
          case_id: caseId,
          submission_type: 'tip',
          description: 'Anonymous tip',
          location: 'Downtown',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user_id).toBeNull();
    });

    it('should fail with missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          // missing description
        });

      expect(res.status).toBe(400);
    });

    it('should fail for non-existent case', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: 99999,
          submission_type: 'sighting',
          description: 'Test',
        });

      expect(res.status).toBe(404);
    });

    it('should create submission with photo reference', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          submission_type: 'photo_evidence',
          description: 'Here is a photo',
          location: 'Library',
          photo_url: 'http://example.com/photo.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.photo_url).toBe('http://example.com/photo.jpg');
    });

    it('should create submission with GPS coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'Spotted here',
          location: 'Times Square',
          latitude: 40.7580,
          longitude: -73.9855,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.latitude).toBe(40.7580);
      expect(res.body.data.longitude).toBe(-73.9855);
    });
  });

  describe('GET /api/v1/submissions/case/:caseId', () => {
    it('should get all submissions for a case', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/case/${caseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter submissions by status', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/case/${caseId}?status=pending`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach(submission => {
        expect(submission.status).toBe('pending');
      });
    });

    it('should return empty array for case with no submissions', async () => {
      // Create new case
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Empty Case',
          description: 'No submissions',
          case_type: 'lost_item',
          location: 'Test',
          bounty_amount: 50,
        });

      const res = await request(app)
        .get(`/api/v1/submissions/case/${caseRes.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/submissions/my-submissions', () => {
    it('should get current user submissions', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/my-submissions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/my-submissions');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/submissions/:id', () => {
    it('should get submission by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(submissionId);
    });

    it('should fail for non-existent submission', async () => {
      const res = await request(app)
        .get('/api/v1/submissions/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/submissions/:id/verify', () => {
    let adminToken;

    beforeAll(async () => {
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
    });

    it('should verify submission (admin only)', async () => {
      const res = await request(app)
        .put(`/api/v1/submissions/${submissionId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'verified',
          bounty_percentage: 100,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('verified');
      expect(res.body.data.bounty_percentage).toBe(100);
    });

    it('should reject submission (admin only)', async () => {
      // Create another submission
      const subRes = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'To be rejected',
        });

      const res = await request(app)
        .put(`/api/v1/submissions/${subRes.body.data.id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'rejected',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });

    it('should fail for non-admin user', async () => {
      const res = await request(app)
        .put(`/api/v1/submissions/${submissionId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'verified',
        });

      expect(res.status).toBe(403);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/submissions/${submissionId}/verify`)
        .send({
          status: 'verified',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/submissions/:id', () => {
    let deleteSubmissionId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          case_id: caseId,
          submission_type: 'sighting',
          description: 'To be deleted',
        });

      deleteSubmissionId = res.body.data.id;
    });

    it('should delete own submission', async () => {
      const res = await request(app)
        .delete(`/api/v1/submissions/${deleteSubmissionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/v1/submissions/${deleteSubmissionId}`);

      expect(res.status).toBe(401);
    });

    it('should fail when deleting another user\'s submission', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Other User',
          email: 'other2@test.com',
          password: 'password123',
          role: 'finder',
        });

      const res = await request(app)
        .delete(`/api/v1/submissions/${deleteSubmissionId}`)
        .set('Authorization', `Bearer ${otherUserRes.body.data.token}`);

      expect(res.status).toBe(403);
    });
  });
});
