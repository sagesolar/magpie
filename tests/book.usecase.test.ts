// Book Use Case Tests
import { BookUseCase } from '../src/application/book.usecase';
import { MockBookRepository, MockExternalBookService } from './mocks';
import { CreateBookDto } from '../src/domain/book.types';

describe('BookUseCase', () => {
  let bookUseCase: BookUseCase;
  let mockRepository: MockBookRepository;
  let mockExternalService: MockExternalBookService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    mockRepository = new MockBookRepository();
    mockExternalService = new MockExternalBookService();
    bookUseCase = new BookUseCase(mockRepository, mockExternalService);
  });

  afterEach(() => {
    mockRepository.clear();
    mockExternalService.clearMockData();
  });

  describe('createBook', () => {
    const validBookData: CreateBookDto = {
      isbn: '9780134685991',
      title: 'Effective TypeScript',
      authors: ['Dan Vanderkam'],
      publisher: "O'Reilly Media",
      publishingYear: 2019,
      type: 'reference',
    };

    it('should create a book successfully', async () => {
      const book = await bookUseCase.createBook(validBookData, testUserId);

      expect(book).toMatchObject(validBookData);
      expect(book.isFavourite).toBe(false);
      expect(book.createdAt).toBeInstanceOf(Date);
      expect(book.updatedAt).toBeInstanceOf(Date);
    });

    it('should set isFavourite to provided value', async () => {
      const bookData = { ...validBookData, isFavourite: true };
      const book = await bookUseCase.createBook(bookData, testUserId);

      expect(book.isFavourite).toBe(true);
    });

    it('should throw error for invalid ISBN', async () => {
      const invalidBookData = { ...validBookData, isbn: '123' };

      await expect(bookUseCase.createBook(invalidBookData, testUserId)).rejects.toThrow(
        'Invalid ISBN format'
      );
    });

    it('should throw error for duplicate ISBN', async () => {
      await bookUseCase.createBook(validBookData, testUserId);

      await expect(bookUseCase.createBook(validBookData, testUserId)).rejects.toThrow(
        'Book with this ISBN already exists'
      );
    });
  });

  describe('getBookByIsbn', () => {
    it('should return book when found', async () => {
      const bookData: CreateBookDto = {
        isbn: '9780134685991',
        title: 'Test Book',
        authors: ['Test Author'],
        publisher: 'Test Publisher',
        publishingYear: 2023,
        type: 'personal',
      };

      await bookUseCase.createBook(bookData, testUserId);
      const foundBook = await bookUseCase.getBookByIsbn('9780134685991');

      expect(foundBook).toMatchObject(bookData);
    });

    it('should return null when book not found', async () => {
      const foundBook = await bookUseCase.getBookByIsbn('9999999999999');

      expect(foundBook).toBeNull();
    });

    it('should throw error for invalid ISBN', async () => {
      await expect(bookUseCase.getBookByIsbn('invalid')).rejects.toThrow('Invalid ISBN format');
    });
  });

  describe('getAllBooks', () => {
    beforeEach(async () => {
      // Create test books
      await bookUseCase.createBook(
        {
          isbn: '1111111111111',
          title: 'JavaScript: The Good Parts',
          authors: ['Douglas Crockford'],
          publisher: "O'Reilly Media",
          publishingYear: 2008,
          type: 'reference',
          genre: 'Programming',
        },
        testUserId
      );

      await bookUseCase.createBook(
        {
          isbn: '2222222222222',
          title: 'Clean Code',
          authors: ['Robert Martin'],
          publisher: 'Prentice Hall',
          publishingYear: 2008,
          type: 'reference',
          genre: 'Programming',
          isFavourite: true,
        },
        testUserId
      );

      await bookUseCase.createBook(
        {
          isbn: '3333333333333',
          title: 'The Hobbit',
          authors: ['J.R.R. Tolkien'],
          publisher: 'George Allen & Unwin',
          publishingYear: 1937,
          type: 'personal',
          genre: 'Fantasy',
        },
        testUserId
      );
    });

    it('should return all books with default pagination', async () => {
      const result = await bookUseCase.getAllBooks();

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by genre', async () => {
      const result = await bookUseCase.getAllBooks({ genre: 'Programming' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(book => book.genre === 'Programming')).toBe(true);
    });

    it('should filter by type', async () => {
      const result = await bookUseCase.getAllBooks({ type: 'personal' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe('personal');
    });

    it('should filter by favourite status', async () => {
      const result = await bookUseCase.getAllBooks({ isFavourite: true });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isFavourite).toBe(true);
    });

    it('should sort by title descending', async () => {
      const result = await bookUseCase.getAllBooks(undefined, {
        field: 'title',
        direction: 'desc',
      });

      expect(result.data[0].title).toBe('The Hobbit');
      expect(result.data[1].title).toBe('JavaScript: The Good Parts');
      expect(result.data[2].title).toBe('Clean Code');
    });

    it('should apply pagination', async () => {
      const result = await bookUseCase.getAllBooks(undefined, undefined, { page: 2, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('updateBook', () => {
    it('should update book successfully', async () => {
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

      const updatedBook = await bookUseCase.updateBook(
        '1111111111111',
        {
          title: 'Updated Title',
          genre: 'Updated Genre',
        },
        testUserId
      );

      expect(updatedBook.title).toBe('Updated Title');
      expect(updatedBook.genre).toBe('Updated Genre');
      expect(updatedBook.authors).toEqual(['Original Author']);
    });

    it('should throw error when book not found', async () => {
      await expect(
        bookUseCase.updateBook('9999999999999', { title: 'New Title' }, testUserId)
      ).rejects.toThrow('Book not found');
    });

    it('should throw error for invalid ISBN', async () => {
      await expect(
        bookUseCase.updateBook('invalid', { title: 'New Title' }, testUserId)
      ).rejects.toThrow('Invalid ISBN format');
    });
  });

  describe('deleteBook', () => {
    it('should delete book successfully', async () => {
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

      await expect(bookUseCase.deleteBook('1111111111111', testUserId)).resolves.not.toThrow();

      const foundBook = await bookUseCase.getBookByIsbn('1111111111111');
      expect(foundBook).toBeNull();
    });

    it('should throw error when book not found', async () => {
      await expect(bookUseCase.deleteBook('9999999999999', testUserId)).rejects.toThrow(
        'Book not found'
      );
    });
  });

  describe('searchBooks', () => {
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

      await bookUseCase.createBook(
        {
          isbn: '2222222222222',
          title: 'Python Basics',
          authors: ['Jane Smith'],
          publisher: 'Code Press',
          publishingYear: 2021,
          type: 'reference',
        },
        testUserId
      );
    });

    it('should search by title', async () => {
      const results = await bookUseCase.searchBooks('JavaScript');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Guide');
    });

    it('should search by author', async () => {
      const results = await bookUseCase.searchBooks('Jane');

      expect(results).toHaveLength(1);
      expect(results[0].authors).toContain('Jane Smith');
    });

    it('should return empty array for empty query', async () => {
      const results = await bookUseCase.searchBooks('');

      expect(results).toHaveLength(0);
    });
  });

  describe('fetchExternalBookData', () => {
    it('should fetch external book data successfully', async () => {
      const result = await bookUseCase.fetchExternalBookData('9780134685991');

      expect(result).toMatchObject({
        title: 'Effective TypeScript',
        authors: ['Dan Vanderkam'],
        publisher: "O'Reilly Media",
        publishingYear: 2019,
      });
    });

    it('should return null for unknown ISBN', async () => {
      const result = await bookUseCase.fetchExternalBookData('9999999999999');

      expect(result).toBeNull();
    });

    it('should throw error for invalid ISBN', async () => {
      await expect(bookUseCase.fetchExternalBookData('invalid')).rejects.toThrow(
        'Invalid ISBN format'
      );
    });
  });

  describe('markAsFavourite', () => {
    it('should mark book as favourite', async () => {
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

      const updatedBook = await bookUseCase.markAsFavourite('1111111111111', true, testUserId);

      expect(updatedBook.isFavourite).toBe(true);
    });
  });

  describe('updateLoanStatus', () => {
    it('should update loan status', async () => {
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

      const loanStatus = {
        isLoaned: true,
        loanedTo: 'John Doe',
        loanedDate: new Date(),
      };

      const updatedBook = await bookUseCase.updateLoanStatus(
        '1111111111111',
        loanStatus,
        testUserId
      );

      expect(updatedBook.loanStatus).toMatchObject(loanStatus);
    });
  });
});
