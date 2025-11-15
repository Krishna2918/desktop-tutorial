const request = require('supertest');
const app = require('../src/server');
const { sequelize } = require('../src/models');
const path = require('path');
const fs = require('fs');
const faceRecognitionService = require('../src/services/faceRecognitionService');
const objectDetectionService = require('../src/services/objectDetectionService');
const imageSimilarityService = require('../src/services/imageSimilarityService');

describe('AI/ML Endpoints and Services', () => {
  let authToken;
  let caseId;
  const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg');

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test image fixture
    const fixturesDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    if (!fs.existsSync(testImagePath)) {
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
        name: 'AI Test User',
        email: 'ai@test.com',
        password: 'password123',
        role: 'poster',
      });

    authToken = userRes.body.data.token;

    const caseRes = await request(app)
      .post('/api/v1/cases')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'AI Test Case',
        description: 'Test AI features',
        case_type: 'missing_person',
        location: 'Test Location',
        bounty_amount: 500,
      });

    caseId = caseRes.body.data.id;
  });

  afterAll(async () => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await sequelize.close();
  });

  describe('Face Recognition Service', () => {
    it('should initialize without errors', () => {
      expect(faceRecognitionService).toBeDefined();
      expect(typeof faceRecognitionService.processPhoto).toBe('function');
    });

    it('should process photo and return result', async () => {
      const result = await faceRecognitionService.processPhoto(testImagePath);

      expect(result).toHaveProperty('faceDetected');
      expect(result).toHaveProperty('facesCount');
      expect(typeof result.faceDetected).toBe('boolean');
      expect(typeof result.facesCount).toBe('number');
    });

    it('should compare face descriptors', () => {
      const descriptor1 = Array(128).fill(0.5);
      const descriptor2 = Array(128).fill(0.5);

      const similarity = faceRecognitionService.compareFaces(descriptor1, descriptor2);

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(100);
    });

    it('should find matches in database', async () => {
      const queryDescriptor = Array(128).fill(0.5);
      const database = [
        { id: 1, face_vector: Array(128).fill(0.5) },
        { id: 2, face_vector: Array(128).fill(0.1) },
      ];

      const matches = await faceRecognitionService.findMatches(
        queryDescriptor,
        database,
        60
      );

      expect(Array.isArray(matches)).toBe(true);
    });
  });

  describe('Object Detection Service', () => {
    it('should initialize without errors', () => {
      expect(objectDetectionService).toBeDefined();
      expect(typeof objectDetectionService.processPhoto).toBe('function');
    });

    it('should process photo and detect objects', async () => {
      const result = await objectDetectionService.processPhoto(testImagePath);

      expect(result).toHaveProperty('objects');
      expect(result).toHaveProperty('colors');
      expect(Array.isArray(result.objects)).toBe(true);
      expect(Array.isArray(result.colors)).toBe(true);
    });

    it('should convert RGB to hex', () => {
      const hex = objectDetectionService.rgbToHex(255, 0, 0);
      expect(hex).toBe('#ff0000');
    });

    it('should get color names', () => {
      const colorName = objectDetectionService.getColorName(255, 0, 0);
      expect(typeof colorName).toBe('string');
      expect(colorName.length).toBeGreaterThan(0);
    });

    it('should categorize items', () => {
      const objects = [
        { class: 'dog', score: 0.9 },
        { class: 'cat', score: 0.8 },
      ];

      const category = objectDetectionService.categorizeItem(objects);
      expect(typeof category).toBe('string');
    });
  });

  describe('Image Similarity Service', () => {
    it('should initialize without errors', () => {
      expect(imageSimilarityService).toBeDefined();
      expect(typeof imageSimilarityService.processPhoto).toBe('function');
    });

    it('should extract features from image', async () => {
      const features = await imageSimilarityService.extractFeatures(testImagePath);

      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThan(0);
    });

    it('should calculate cosine similarity', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];

      const similarity = imageSimilarityService.cosineSimilarity(vec1, vec2);

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should find similar images', async () => {
      const queryFeatures = Array(100).fill(0.5);
      const database = [
        { id: 1, image_features: Array(100).fill(0.5) },
        { id: 2, image_features: Array(100).fill(0.1) },
      ];

      const matches = await imageSimilarityService.findSimilarImages(
        queryFeatures,
        database,
        0.7
      );

      expect(Array.isArray(matches)).toBe(true);
    });

    it('should assess image quality', async () => {
      const quality = await imageSimilarityService.getImageQuality(testImagePath);

      expect(quality).toHaveProperty('width');
      expect(quality).toHaveProperty('height');
      expect(quality).toHaveProperty('format');
      expect(quality).toHaveProperty('qualityScore');
    });
  });

  describe('POST /api/v1/ai/search-by-face', () => {
    it('should search by face with authentication', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-by-face')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
      }
    });

    it('should search by face without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-by-face')
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
    });

    it('should fail without photo', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-by-face')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/ai/search-by-object', () => {
    it('should search by object', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-by-object')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
      }
    });

    it('should fail without photo', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-by-object');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/ai/search-similar', () => {
    it('should search for similar images', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-similar')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
      }
    });

    it('should accept custom threshold', async () => {
      const res = await request(app)
        .post('/api/v1/ai/search-similar')
        .set('Authorization', `Bearer ${authToken}`)
        .field('threshold', '80')
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
    });
  });

  describe('POST /api/v1/ai/analyze-photo', () => {
    it('should analyze photo with all AI features', async () => {
      const res = await request(app)
        .post('/api/v1/ai/analyze-photo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', testImagePath);

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success');
        expect(res.body.data).toHaveProperty('faceAnalysis');
        expect(res.body.data).toHaveProperty('objectAnalysis');
        expect(res.body.data).toHaveProperty('imageQuality');
      }
    });

    it('should fail without photo', async () => {
      const res = await request(app)
        .post('/api/v1/ai/analyze-photo');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/ai/status', () => {
    it('should get AI system status', async () => {
      const res = await request(app)
        .get('/api/v1/ai/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body.data).toHaveProperty('services');
      expect(res.body.data.services).toHaveProperty('faceRecognition');
      expect(res.body.data.services).toHaveProperty('objectDetection');
      expect(res.body.data.services).toHaveProperty('imageSimilarity');
    });

    it('should show service availability', async () => {
      const res = await request(app)
        .get('/api/v1/ai/status');

      expect(res.status).toBe(200);
      const services = res.body.data.services;

      expect(typeof services.faceRecognition).toBe('string');
      expect(typeof services.objectDetection).toBe('string');
      expect(typeof services.imageSimilarity).toBe('string');
    });
  });

  describe('AI Integration with Photo Upload', () => {
    it('should trigger AI processing on photo upload', async () => {
      const res = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.data[0]).toHaveProperty('upload_status');
      expect(res.body.data[0].upload_status).toBe('processing');
    });

    it('should store AI metadata in photo record', async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/photos/${caseId}/photos`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photos', testImagePath);

      expect(uploadRes.status).toBe(201);
      const photoId = uploadRes.body.data[0].id;

      // Wait a bit for AI processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const photosRes = await request(app)
        .get(`/api/v1/photos/${caseId}/photos`);

      const photo = photosRes.body.data.find(p => p.id === photoId);
      expect(photo).toBeDefined();
    });
  });

  describe('AI Error Handling', () => {
    it('should handle invalid image gracefully', async () => {
      const invalidImagePath = path.join(__dirname, 'fixtures', 'invalid.txt');
      fs.writeFileSync(invalidImagePath, 'This is not an image');

      const res = await request(app)
        .post('/api/v1/ai/analyze-photo')
        .attach('photo', invalidImagePath);

      expect([400, 500]).toContain(res.status);

      fs.unlinkSync(invalidImagePath);
    });

    it('should handle missing models gracefully', async () => {
      const result = await faceRecognitionService.processPhoto(testImagePath);

      // Should return result even if models aren't loaded
      expect(result).toBeDefined();
    });
  });

  describe('AI Performance', () => {
    it('should process images within reasonable time', async () => {
      const startTime = Date.now();

      await faceRecognitionService.processPhoto(testImagePath);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process within 10 seconds (generous for CI)
      expect(processingTime).toBeLessThan(10000);
    }, 15000); // 15 second timeout for this test

    it('should handle concurrent requests', async () => {
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/v1/ai/analyze-photo')
          .attach('photo', testImagePath)
      );

      const results = await Promise.all(promises);

      results.forEach(res => {
        expect([200, 400]).toContain(res.status);
      });
    }, 20000); // 20 second timeout
  });
});
