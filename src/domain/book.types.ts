// Domain Entity - Book
export interface Book {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  edition?: string;
  publishingYear: number;
  pages?: number;
  genre?: string;
  description?: string;
  coverImageUrl?: string;
  goodreadsLink?: string;
  physicalLocation?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string;
  isFavourite: boolean;
  type: 'reference' | 'personal';
  loanStatus?: {
    isLoaned: boolean;
    loanedTo?: string;
    loanedDate?: Date;
    expectedReturnDate?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Create Book DTO for input validation
export interface CreateBookDto {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  edition?: string;
  publishingYear: number;
  pages?: number;
  genre?: string;
  description?: string;
  coverImageUrl?: string;
  goodreadsLink?: string;
  physicalLocation?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  notes?: string;
  isFavourite?: boolean;
  type: 'reference' | 'personal';
}

// Update Book DTO
export interface UpdateBookDto extends Partial<CreateBookDto> {
  loanStatus?: {
    isLoaned: boolean;
    loanedTo?: string;
    loanedDate?: Date;
    expectedReturnDate?: Date;
  };
}

// Search and filter interfaces
export interface BookSearchCriteria {
  query?: string; // Search in title, author, isbn
  genre?: string;
  type?: 'reference' | 'personal';
  isFavourite?: boolean;
  isLoaned?: boolean;
  condition?: string;
}

export interface BookSortOptions {
  field: 'title' | 'author' | 'genre' | 'publishingYear' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
