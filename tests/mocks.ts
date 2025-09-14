// Mock implementations for testing
import {
  Book,
  CreateBookDto,
  UpdateBookDto,
  BookSearchCriteria,
  BookSortOptions,
  PaginationOptions,
  PaginatedResult,
  ShareBookDto,
  DEFAULT_OWNER_PERMISSIONS,
} from '../src/domain/book.types';
import { BookRepository, ExternalBookService } from '../src/infrastructure/interfaces';

export class MockBookRepository implements BookRepository {
  private books: Book[] = [];

  async create(bookData: CreateBookDto, userId: string): Promise<Book> {
    const book: Book = {
      ...bookData,
      isFavourite: bookData.isFavourite ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: userId,
      sharedWith: [],
      permissions: { ...DEFAULT_OWNER_PERMISSIONS },
    };
    this.books.push(book);
    return book;
  }

  async findById(isbn: string, userId?: string): Promise<Book | null> {
    const book = this.books.find(book => book.isbn === isbn) || null;
    if (!book || !userId) return book;

    // Check if user has access
    if (book.ownerId === userId || book.sharedWith.includes(userId)) {
      return book;
    }

    return null;
  }

  async close(): Promise<void> {
    // Mock implementation - no cleanup needed
  }

  async findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions,
    userId?: string
  ): Promise<PaginatedResult<Book>> {
    let filteredBooks = [...this.books];

    // Filter by user access
    if (userId) {
      filteredBooks = filteredBooks.filter(
        book => book.ownerId === userId || book.sharedWith.includes(userId)
      );
    }

    // Apply search criteria
    if (criteria?.query) {
      const query = criteria.query.toLowerCase();
      filteredBooks = filteredBooks.filter(
        book =>
          book.title.toLowerCase().includes(query) ||
          book.authors.some(author => author.toLowerCase().includes(query)) ||
          book.isbn.includes(query)
      );
    }

    if (criteria?.genre) {
      filteredBooks = filteredBooks.filter(book => book.genre === criteria.genre);
    }

    if (criteria?.type) {
      filteredBooks = filteredBooks.filter(book => book.type === criteria.type);
    }

    if (criteria?.isFavourite !== undefined) {
      filteredBooks = filteredBooks.filter(book => book.isFavourite === criteria.isFavourite);
    }

    // Apply sorting
    if (sort) {
      filteredBooks.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sort.field) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'author':
            aValue = a.authors[0] || '';
            bValue = b.authors[0] || '';
            break;
          case 'publishingYear':
            aValue = a.publishingYear;
            bValue = b.publishingYear;
            break;
          default:
            aValue = a.title;
            bValue = b.title;
        }

        if (sort.direction === 'desc') {
          return bValue > aValue ? 1 : -1;
        }
        return aValue > bValue ? 1 : -1;
      });
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const offset = (page - 1) * limit;
    const paginatedBooks = filteredBooks.slice(offset, offset + limit);

    return {
      data: paginatedBooks,
      total: filteredBooks.length,
      page,
      limit,
      totalPages: Math.ceil(filteredBooks.length / limit),
    };
  }

  async update(isbn: string, updates: UpdateBookDto, userId: string): Promise<Book | null> {
    const bookIndex = this.books.findIndex(book => book.isbn === isbn);
    if (bookIndex === -1) return null;

    const book = this.books[bookIndex];

    // Check if user has edit rights
    if (
      book.ownerId !== userId &&
      (!book.sharedWith.includes(userId) || !book.permissions.canEdit)
    ) {
      return null;
    }

    this.books[bookIndex] = {
      ...book,
      ...updates,
      permissions: { ...book.permissions, ...updates.permissions },
      updatedAt: new Date(),
    };

    return this.books[bookIndex];
  }

  async delete(isbn: string, userId: string): Promise<boolean> {
    const bookIndex = this.books.findIndex(book => book.isbn === isbn);
    if (bookIndex === -1) return false;

    const book = this.books[bookIndex];

    // Check if user has remove rights
    if (
      book.ownerId !== userId &&
      (!book.sharedWith.includes(userId) || !book.permissions.canRemove)
    ) {
      return false;
    }

    this.books.splice(bookIndex, 1);
    return true;
  }

  async search(query: string, userId?: string): Promise<Book[]> {
    const lowerQuery = query.toLowerCase();
    let books = this.books.filter(
      book =>
        book.title.toLowerCase().includes(lowerQuery) ||
        book.authors.some(author => author.toLowerCase().includes(lowerQuery)) ||
        book.isbn.includes(query)
    );

    // Filter by user access
    if (userId) {
      books = books.filter(book => book.ownerId === userId || book.sharedWith.includes(userId));
    }

    return books;
  }

  async shareBook(isbn: string, shareData: ShareBookDto, userId: string): Promise<Book | null> {
    const bookIndex = this.books.findIndex(book => book.isbn === isbn);
    if (bookIndex === -1) return null;

    const book = this.books[bookIndex];

    // Check if user has share rights
    if (
      book.ownerId !== userId &&
      (!book.sharedWith.includes(userId) || !book.permissions.canShare)
    ) {
      return null;
    }

    // Add users to shared access if not already included
    shareData.userIds.forEach(userId => {
      if (!book.sharedWith.includes(userId)) {
        book.sharedWith.push(userId);
      }
    });

    this.books[bookIndex] = {
      ...book,
      updatedAt: new Date(),
    };

    return this.books[bookIndex];
  }

  async removeUserFromBook(
    isbn: string,
    userIdToRemove: string,
    requestingUserId: string
  ): Promise<Book | null> {
    const bookIndex = this.books.findIndex(book => book.isbn === isbn);
    if (bookIndex === -1) return null;

    const book = this.books[bookIndex];

    // Check if requesting user has share rights
    if (
      book.ownerId !== requestingUserId &&
      (!book.sharedWith.includes(requestingUserId) || !book.permissions.canShare)
    ) {
      return null;
    }

    // Remove user from shared access
    book.sharedWith = book.sharedWith.filter(id => id !== userIdToRemove);

    this.books[bookIndex] = {
      ...book,
      updatedAt: new Date(),
    };

    return this.books[bookIndex];
  }

  async getUserBooks(userId: string, includeShared = true): Promise<Book[]> {
    if (includeShared) {
      return this.books.filter(book => book.ownerId === userId || book.sharedWith.includes(userId));
    } else {
      return this.books.filter(book => book.ownerId === userId);
    }
  }

  // Helper methods for testing
  clear(): void {
    this.books = [];
  }

  getAll(): Book[] {
    return [...this.books];
  }
}

export class MockExternalBookService implements ExternalBookService {
  private mockData: Record<string, Partial<Book>> = {
    '9780134685991': {
      title: 'Effective TypeScript',
      authors: ['Dan Vanderkam'],
      publisher: "O'Reilly Media",
      publishingYear: 2019,
      pages: 264,
      genre: 'Programming',
      description: 'Learn TypeScript best practices',
    },
  };

  async fetchBookByIsbn(isbn: string): Promise<Partial<Book> | null> {
    return this.mockData[isbn] || null;
  }

  // Helper for testing
  setMockData(isbn: string, data: Partial<Book>): void {
    this.mockData[isbn] = data;
  }

  clearMockData(): void {
    this.mockData = {};
  }
}

export class MockAuthMiddleware {
  extractContext() {
    return async (req: any, res: any, next: any) => {
      if (req.headers.authorization === 'Bearer valid-token') {
        req.userContext = {
          isAuthenticated: true,
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        };
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        };
      } else {
        req.userContext = { isAuthenticated: false };
      }
      next();
    };
  }

  requireAuth() {
    return async (req: any, res: any, next: any) => {
      if (req.headers.authorization === 'Bearer valid-token') {
        req.userContext = {
          isAuthenticated: true,
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        };
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        };
        next();
      } else {
        res.status(401).json({ error: 'Authentication required' });
      }
    };
  }
}
