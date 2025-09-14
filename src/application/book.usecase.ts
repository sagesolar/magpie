// Use Cases - Application layer business logic
import {
  Book,
  CreateBookDto,
  UpdateBookDto,
  BookSearchCriteria,
  BookSortOptions,
  PaginationOptions,
  PaginatedResult,
  ShareBookDto,
} from '../domain/book.types';
import { BookRepository, ExternalBookService } from '../infrastructure/interfaces';

export class BookUseCase {
  constructor(
    private bookRepository: BookRepository,
    private externalBookService: ExternalBookService
  ) {}

  async createBook(bookData: CreateBookDto, userId: string): Promise<Book> {
    // Validate ISBN format
    if (!this.isValidIsbn(bookData.isbn)) {
      throw new Error('Invalid ISBN format');
    }

    // Check if book already exists for this user
    const existingBook = await this.bookRepository.findById(bookData.isbn, userId);
    if (existingBook) {
      throw new Error('Book with this ISBN already exists in your collection');
    }

    return this.bookRepository.create(
      {
        ...bookData,
        isFavourite: bookData.isFavourite ?? false,
      },
      userId
    );
  }

  async getBookByIsbn(isbn: string, userId?: string): Promise<Book | null> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    return this.bookRepository.findById(isbn, userId);
  }

  async getAllBooks(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions,
    userId?: string
  ): Promise<PaginatedResult<Book>> {
    const defaultPagination = { page: 1, limit: 20 };
    const defaultSort = { field: 'title' as const, direction: 'asc' as const };

    return this.bookRepository.findAll(
      criteria,
      sort || defaultSort,
      pagination || defaultPagination,
      userId
    );
  }

  async getUserBooks(userId: string, includeShared: boolean = true): Promise<Book[]> {
    return this.bookRepository.getUserBooks(userId, includeShared);
  }

  async updateBook(isbn: string, updates: UpdateBookDto, userId: string): Promise<Book> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const updatedBook = await this.bookRepository.update(isbn, updates, userId);
    if (!updatedBook) {
      throw new Error('Book not found or you do not have permission to edit it');
    }

    return updatedBook;
  }

  async deleteBook(isbn: string, userId: string): Promise<void> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const deleted = await this.bookRepository.delete(isbn, userId);
    if (!deleted) {
      throw new Error('Book not found or you do not have permission to delete it');
    }
  }

  async searchBooks(query: string, userId?: string): Promise<Book[]> {
    if (!query.trim()) {
      return [];
    }

    return this.bookRepository.search(query.trim(), userId);
  }

  async shareBook(isbn: string, shareData: ShareBookDto, userId: string): Promise<Book> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const sharedBook = await this.bookRepository.shareBook(isbn, shareData, userId);
    if (!sharedBook) {
      throw new Error('Book not found or you do not have permission to share it');
    }

    return sharedBook;
  }

  async removeUserFromBook(
    isbn: string,
    userIdToRemove: string,
    requestingUserId: string
  ): Promise<Book> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    const updatedBook = await this.bookRepository.removeUserFromBook(
      isbn,
      userIdToRemove,
      requestingUserId
    );
    if (!updatedBook) {
      throw new Error('Book not found or you do not have permission to modify sharing');
    }

    return updatedBook;
  }

  async fetchExternalBookData(isbn: string): Promise<Partial<Book> | null> {
    if (!this.isValidIsbn(isbn)) {
      throw new Error('Invalid ISBN format');
    }

    return this.externalBookService.fetchBookByIsbn(isbn);
  }

  async markAsFavourite(isbn: string, isFavourite: boolean, userId: string): Promise<Book> {
    return this.updateBook(isbn, { isFavourite }, userId);
  }

  async updateLoanStatus(
    isbn: string,
    loanStatus: {
      isLoaned: boolean;
      loanedTo?: string;
      loanedDate?: Date;
      expectedReturnDate?: Date;
    },
    userId: string
  ): Promise<Book> {
    return this.updateBook(isbn, { loanStatus }, userId);
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
