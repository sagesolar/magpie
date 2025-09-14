// Book Controller API Tests
import request from 'supertest';
import express from 'express';
import { BookController } from '../src/api/book.controller';
import { createBookRoutes } from '../src/api/book.routes';
import { BookUseCase } from '../src/application/book.usecase';
import { AuthenticationMiddleware } from '../src/infrastructure/auth.middleware';
import { MockBookRepository, MockExternalBookService, MockAuthMiddleware } from './mocks';

describe('BookController API', () => {
  let app: express.Application;
  let bookUseCase: BookUseCase;
  let mockRepository: MockBookRepository;
  let mockExternalService: MockExternalBookService;
  let mockAuthMiddleware: MockAuthMiddleware;
  const testUserId = 'user-123';

  beforeEach(() => {
    // Setup
    mockRepository = new MockBookRepository();
    mockExternalService = new MockExternalBookService();
    mockAuthMiddleware = new MockAuthMiddleware();
    bookUseCase = new BookUseCase(mockRepository, mockExternalService);

    const bookController = new BookController(bookUseCase);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api', createBookRoutes(bookController, mockAuthMiddleware as any));

    // Error handler
    app.use(
      (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (error.name === 'ZodError') {
          return res.status(400).json({
            error: 'Validation error',
            details: error.errors,
          });
        }

        if (error.message) {
          const statusCode = error.message.includes('not found')
            ? 404
            : error.message.includes('already exists')
              ? 409
              : 400;
          return res.status(statusCode).json({ error: error.message });
        }

        res.status(500).json({ error: 'Internal server error' });
      }
    );
  });

  afterEach(() => {
    mockRepository.clear();
    mockExternalService.clearMockData();
  });

  describe('GET /api/books', () => {
    beforeEach(async () => {
      // Add test data
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'JavaScript Guide',
          authors: ['John Doe'],
          publisher: 'Tech Books',
          publishingYear: 2020,
          type: 'reference',
          genre: 'Programming',
        },
        testUserId
      );

      await bookUseCase.createBook(
        {
          isbn: '2222222222222',
          title: 'Python Basics',
          authors: ['Jane Smith'],
          publisher: 'Code Press',
          publishingYear: 2021,
          type: 'personal',
          genre: 'Programming',
          isFavourite: true,
        },
        testUserId
      );
    });

    it('should return all books', async () => {
      const response = await request(app).get('/api/books');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('should filter by genre', async () => {
      const response = await request(app).get('/api/books?genre=Programming');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by type', async () => {
      const response = await request(app).get('/api/books?type=personal');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('personal');
    });

    it('should filter by favourite status', async () => {
      const response = await request(app).get('/api/books?isFavourite=true');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isFavourite).toBe(true);
    });

    it('should apply pagination', async () => {
      const response = await request(app).get('/api/books?page=1&limit=1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
      expect(response.body.totalPages).toBe(2);
    });

    it('should sort books', async () => {
      const response = await request(app).get('/api/books?sortField=title&sortDirection=desc');

      expect(response.status).toBe(200);
      expect(response.body.data[0].title).toBe('Python Basics');
      expect(response.body.data[1].title).toBe('JavaScript Guide');
    });
  });

  describe('GET /api/books/:isbn', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'Test Book',
          authors: ['Test Author'],
          publisher: 'Test Publisher',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should return book by ISBN', async () => {
      const response = await request(app).get('/api/books/1111111111111');

      expect(response.status).toBe(200);
      expect(response.body.isbn).toBe('1111111111111');
      expect(response.body.title).toBe('Test Book');
    });

    it('should return 404 for non-existent book', async () => {
      const response = await request(app).get('/api/books/9999999999999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Book not found');
    });

    it('should return 400 for invalid ISBN', async () => {
      const response = await request(app).get('/api/books/invalid');

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/books', () => {
    const validBookData = {
      isbn: '1111111111111',
      title: 'New Book',
      authors: ['New Author'],
      publisher: 'New Publisher',
      publishingYear: 2023,
      type: 'reference',
    };

    it('should create a new book', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', 'Bearer valid-token')
        .send(validBookData);

      expect(response.status).toBe(201);
      expect(response.body.isbn).toBe(validBookData.isbn);
      expect(response.body.title).toBe(validBookData.title);
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { ...validBookData, publishingYear: 'invalid' };

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate ISBN', async () => {
      await request(app)
        .post('/api/books')
        .set('Authorization', 'Bearer valid-token')
        .send(validBookData);

      const response = await request(app)
        .post('/api/books')
        .set('Authorization', 'Bearer valid-token')
        .send(validBookData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Book with this ISBN already exists in your collection');
    });
  });

  describe('PUT /api/books/:isbn', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'Original Title',
          authors: ['Original Author'],
          publisher: 'Original Publisher',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should update a book', async () => {
      const updateData = {
        title: 'Updated Title',
        genre: 'Updated Genre',
      };

      const response = await request(app)
        .put('/api/books/1111111111111')
        .set('Authorization', 'Bearer valid-token')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.genre).toBe('Updated Genre');
    });

    it('should return 404 for non-existent book', async () => {
      const response = await request(app)
        .put('/api/books/9999999999999')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Book not found or you do not have permission to edit it');
    });
  });

  describe('DELETE /api/books/:isbn', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'Test Book',
          authors: ['Test Author'],
          publisher: 'Test Publisher',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should delete a book', async () => {
      const response = await request(app)
        .delete('/api/books/1111111111111')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent book', async () => {
      const response = await request(app)
        .delete('/api/books/9999999999999')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Book not found or you do not have permission to delete it');
    });
  });

  describe('GET /api/search', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'JavaScript Guide',
          authors: ['John Doe'],
          publisher: 'Tech Books',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should search books', async () => {
      const response = await request(app).get('/api/search?q=JavaScript');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('JavaScript Guide');
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app).get('/api/search');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query parameter "q" is required');
    });
  });

  describe('GET /api/external/:isbn', () => {
    it('should fetch external book data', async () => {
      const response = await request(app).get('/api/external/9780134685991');

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Effective TypeScript');
    });

    it('should return 404 for unknown ISBN', async () => {
      const response = await request(app).get('/api/external/9999999999999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Book data not found in external sources');
    });
  });

  describe('PUT /api/books/:isbn/favourite', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'Test Book',
          authors: ['Test Author'],
          publisher: 'Test Publisher',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should toggle favourite status', async () => {
      const response = await request(app)
        .put('/api/books/1111111111111/favourite')
        .set('Authorization', 'Bearer valid-token')
        .send({ isFavourite: true });

      expect(response.status).toBe(200);
      expect(response.body.isFavourite).toBe(true);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .put('/api/books/1111111111111/favourite')
        .set('Authorization', 'Bearer valid-token')
        .send({ isFavourite: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('isFavourite must be a boolean');
    });
  });

  describe('PUT /api/books/:isbn/loan', () => {
    beforeEach(async () => {
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'Test Book',
          authors: ['Test Author'],
          publisher: 'Test Publisher',
          publishingYear: 2020,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should update loan status', async () => {
      const loanStatus = {
        isLoaned: true,
        loanedTo: 'John Doe',
        loanedDate: new Date().toISOString(),
      };

      const response = await request(app)
        .put('/api/books/1111111111111/loan')
        .set('Authorization', 'Bearer valid-token')
        .send({ loanStatus });

      expect(response.status).toBe(200);
      expect(response.body.loanStatus.isLoaned).toBe(true);
      expect(response.body.loanStatus.loanedTo).toBe('John Doe');
    });

    it('should return 400 for invalid loan status', async () => {
      const response = await request(app)
        .put('/api/books/1111111111111/loan')
        .set('Authorization', 'Bearer valid-token')
        .send({ loanStatus: { invalid: true } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid loan status data');
    });
  });
});
