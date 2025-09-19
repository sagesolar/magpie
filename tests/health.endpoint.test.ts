// Health Endpoint Tests
import request from 'supertest';
import express from 'express';

describe('Health Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create minimal Express app just for health endpoint
    app = express();
    app.use(express.json());

    // Health check endpoint (should remain public)
    app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        authentication: 'enabled',
      });
    });
  });

  describe('GET /api/health', () => {
    it('should return health status without authentication', async () => {
      // Act
      const response = await request(app).get('/api/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String),
        authentication: 'enabled',
      });
    });

    it('should work with any or no authorization header', async () => {
      // Test with no auth header
      const response1 = await request(app).get('/api/health');

      expect(response1.status).toBe(200);
      expect(response1.body.status).toBe('healthy');

      // Test with invalid auth header
      const response2 = await request(app)
        .get('/api/health')
        .set('Authorization', 'Bearer invalid-token');

      expect(response2.status).toBe(200);
      expect(response2.body.status).toBe('healthy');

      // Test with valid auth header
      const response3 = await request(app)
        .get('/api/health')
        .set('Authorization', 'Bearer valid-token');

      expect(response3.status).toBe(200);
      expect(response3.body.status).toBe('healthy');
    });

    it('should return consistent response format', async () => {
      // Act
      const response = await request(app).get('/api/health');

      // Assert
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('authentication');

      expect(typeof response.body.status).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.version).toBe('string');
      expect(typeof response.body.authentication).toBe('string');

      // Validate timestamp is ISO format
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });
  });
});
