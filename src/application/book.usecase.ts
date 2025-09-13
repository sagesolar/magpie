// Use Cases - Application layer business logic
import {
  Book,
  CreateBookDto,
  UpdateBookDto,
  BookSearchCriteria,
  BookSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../domain/book.types';
import { BookRepository, ExternalBookService } from '../infrastructure/interfaces';

export class BookUseCase {
  constructor(
    private bookRepository: BookRepository,
    private externalBookService: ExternalBookService
  ) {}

  async createBook(bookData: CreateBookDto): Promise<Book> {
    // Validate ISBN format
    if (!this.isValidIsbn(bookData.isbn)) {
      throw new Error('Invalid ISBN format');
    }

    // Check if book already exists
    const existingBook = await this.bookRepository.findById(bookData.isbn);
    if (existingBook) {
      throw new Error('Book with this ISBN already exists');
    }

    return this.bookRepository.create({
      ...bookData,
      isFavourite: bookData.isFavourite ?? false,
    });
  }

  async getBookByIsbn(isbn: string): Promise<Book | null> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    return this.bookRepository.findById(isbn);
  }

  async getAllBooks(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Book>> {
    const defaultPagination = { page: 1, limit: 20 };
    const defaultSort = { field: 'title' as const, direction: 'asc' as const };

    return this.bookRepository.findAll(
      criteria,
      sort || defaultSort,
      pagination || defaultPagination
    );
  }

  async updateBook(isbn: string, updates: UpdateBookDto): Promise<Book> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const updatedBook = await this.bookRepository.update(isbn, updates);
    if (!updatedBook) {
      throw new Error('Book not found');
    }

    return updatedBook;
  }

  async deleteBook(isbn: string): Promise<void> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const deleted = await this.bookRepository.delete(isbn);
    if (!deleted) {
      throw new Error('Book not found');
    }
  }

  async searchBooks(query: string): Promise<Book[]> {
    if (!query.trim()) {
      return [];
    }

    return this.bookRepository.search(query.trim());
  }

  async fetchExternalBookData(isbn: string): Promise<Partial<Book> | null> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    return this.externalBookService.fetchBookByIsbn(isbn);
  }

  async markAsFavourite(isbn: string, isFavourite: boolean): Promise<Book> {
    return this.updateBook(isbn, { isFavourite });
  }

  async updateLoanStatus(
    isbn: string,
    loanStatus: {
      isLoaned: boolean;
      loanedTo?: string;
      loanedDate?: Date;
      expectedReturnDate?: Date;
    }
  ): Promise<Book> {
    return this.updateBook(isbn, { loanStatus });
  }

  private isValidIsbn(isbn: string): boolean {
    // Remove hyphens and spaces
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    // Check length (10 or 13 digits)
    if (!/^\d{10}$|^\d{13}$/.test(cleanIsbn)) {
      return false;
    }

    // Add ISBN validation logic here if needed
    return true;
  }
}
