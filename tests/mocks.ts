// Mock implementations for testing
import { Book, CreateBookDto, UpdateBookDto, BookSearchCriteria, BookSortOptions, PaginationOptions, PaginatedResult } from '../src/domain/book.types';
import { BookRepository, ExternalBookService } from '../src/infrastructure/interfaces';

export class MockBookRepository implements BookRepository {
  private books: Book[] = [];

  async create(bookData: CreateBookDto): Promise<Book> {
    const book: Book = {
      ...bookData,
      isFavourite: bookData.isFavourite ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.books.push(book);
    return book;
  }

  async findById(isbn: string): Promise<Book | null> {
    return this.books.find(book => book.isbn === isbn) || null;
  }

  async close(): Promise<void> {
    // Mock implementation - no cleanup needed
  }

  async findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Book>> {
    let filteredBooks = [...this.books];

    // Apply search criteria
    if (criteria?.query) {
      const query = criteria.query.toLowerCase();
      filteredBooks = filteredBooks.filter(book =>
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

  async update(isbn: string, updates: UpdateBookDto): Promise<Book | null> {
    const bookIndex = this.books.findIndex(book => book.isbn === isbn);
    if (bookIndex === -1) return null;

    this.books[bookIndex] = {
      ...this.books[bookIndex],
      ...updates,
      updatedAt: new Date(),
    };

    return this.books[bookIndex];
  }

  async delete(isbn: string): Promise<boolean> {
    const initialLength = this.books.length;
    this.books = this.books.filter(book => book.isbn !== isbn);
    return this.books.length < initialLength;
  }

  async search(query: string): Promise<Book[]> {
    const lowerQuery = query.toLowerCase();
    return this.books.filter(book =>
      book.title.toLowerCase().includes(lowerQuery) ||
      book.authors.some(author => author.toLowerCase().includes(lowerQuery)) ||
      book.isbn.includes(query)
    );
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
