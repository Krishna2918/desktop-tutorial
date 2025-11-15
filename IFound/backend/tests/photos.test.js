const request = require('supertest');
const app = require('../src/server');
const { sequelize, User, Case, Photo } = require('../src/models');
const path = require('path');
const fs = require('fs');

describe('Photo Endpoints', () => {
  let authToken;
  let userId;
  let caseId;
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test image fixture if doesn't exist
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    if (!fs.existsSync(testImagePath)) {
      // Create a minimal valid JPEG file
      const buffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
      ]);
      fs.writeFileSync(testImagePath, buffer);
    }

    // Create test user and case
    const userRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Photo Test User',
        email: 'photo@test.com',
        password: 'password123',
        role: 'poster',
      });

    authToken = userRes.body.data.token;
    userId = userRes.body.data.user.id;

    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Case for Photos',
        description: 'Test description',
        case_type: 'lost_item',
        location: 'Test Location',
        bounty_amount: 100,
      });

    caseId = caseRes.body.data.id;
  });

  afterAll(async () => {
    // Cleanup test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await sequelize.close();
  });

  describe('POST /api/v1/photos/:caseId/photos', () => {
    it('should upload a photo successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('id');
      expect(res.body.data[0]).toHaveProperty('file_path');
      expect(res.body.data[0].case_id).toBe(caseId);
    });

    it('should upload multiple photos', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath)
        .attach('photos', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(2);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .attach('photos', testImagePath);

      expect(res.status).toBe(401);
    });

    it('should fail for non-existent case', async () => {
      const res = await request(app)
        .post('/api/v1/photos/99999/photos')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      expect(res.status).toBe(404);
    });

    it('should fail without photo file', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/photos/:caseId/photos', () => {
    it('should get all photos for a case', async () => {
      const res = await request(app)
        .get(`/api/v1/photos/${caseId}/photos`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return empty array for case with no photos', async () => {
      // Create a new case without photos
      const caseRes = await request(app)
        .post('/api/v1/cases')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Empty Case',
          description: 'No photos',
          case_type: 'lost_item',
          location: 'Test',
          bounty_amount: 50,
        });

      const res = await request(app)
        .get(`/api/v1/photos/${caseRes.body.data.id}/photos`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('PUT /api/v1/photos/:id/set-primary', () => {
    let photoId;

    beforeEach(async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      photoId = uploadRes.body.data[0].id;
    });

    it('should set photo as primary', async () => {
      const res = await request(app)
        .put(`/api/v1/photos/${photoId}/set-primary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_primary).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put(`/api/v1/photos/${photoId}/set-primary`);

      expect(res.status).toBe(401);
    });

    it('should fail for non-existent photo', async () => {
      const res = await request(app)
        .put('/api/v1/photos/99999/set-primary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/photos/:id', () => {
    let photoId;

    beforeEach(async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      photoId = uploadRes.body.data[0].id;
    });

    it('should delete photo successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/photos/${photoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify photo is deleted
      const photo = await Photo.findByPk(photoId);
      expect(photo).toBeNull();
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/v1/photos/${photoId}`);

      expect(res.status).toBe(401);
    });

    it('should fail for non-existent photo', async () => {
      const res = await request(app)
        .delete('/api/v1/photos/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should fail when deleting another user\'s photo', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Other User',
          email: 'other@test.com',
          password: 'password123',
          role: 'poster',
        });

      const res = await request(app)
        .delete(`/api/v1/photos/${photoId}`)
        .set('Authorization', `Bearer ${otherUserRes.body.data.token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Photo AI Processing', () => {
    it('should set photo status to processing on upload', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.data[0].upload_status).toBe('processing');
    });
  });
});
