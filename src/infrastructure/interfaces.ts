// Repository interface - abstracts data access
import {
  Book,
  CreateBookDto,
  UpdateBookDto,
  BookSearchCriteria,
  BookSortOptions,
  PaginationOptions,
  PaginatedResult,
} from '../domain/book.types';

export interface BookRepository {
  create(book: CreateBookDto): Promise<Book>;
  findById(isbn: string): Promise<Book | null>;
  findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Book>>;
  update(isbn: string, updates: UpdateBookDto): Promise<Book | null>;
  delete(isbn: string): Promise<boolean>;
  search(query: string): Promise<Book[]>;
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
