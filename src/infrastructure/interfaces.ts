// Repository interface - abstracts data access
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

export interface BookRepository {
  create(book: CreateBookDto, userId: string): Promise<Book>;
  findById(isbn: string, userId?: string): Promise<Book | null>;
  findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions,
    userId?: string
  ): Promise<PaginatedResult<Book>>;
  update(isbn: string, updates: UpdateBookDto, userId: string): Promise<Book | null>;
  delete(isbn: string, userId: string): Promise<boolean>;
  search(query: string, userId?: string): Promise<Book[]>;
  shareBook(isbn: string, shareData: ShareBookDto, userId: string): Promise<Book | null>;
  removeUserFromBook(
    isbn: string,
    userIdToRemove: string,
    requestingUserId: string
  ): Promise<Book | null>;
  getUserBooks(userId: string, includeShared?: boolean): Promise<Book[]>;
  close(): Promise<void>;
}

// External book data service interface
export interface ExternalBookService {
  fetchBookByIsbn(isbn: string): Promise<Partial<Book> | null>;
}

// Sync service interface for PWA offline support
export interface SyncService {
  processBatch(changes: BookSyncChange[]): Promise<SyncResult>;
}

export interface BookSyncChange {
  operation: 'create' | 'update' | 'delete';
  isbn: string;
  data?: CreateBookDto | UpdateBookDto;
  timestamp: Date;
}

export interface BookSyncConflict {
  isbn: string;
  localVersion: Book;
  remoteVersion: Book;
  conflictFields: string[];
}

export interface SyncResult {
  success: boolean;
  conflicts: BookSyncConflict[];
  processed: number;
  failed: number;
}
