// Domain Entity - Book with ownership tracking
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

  // Ownership & Sharing - Standard authentication terminology
  ownerId: string; // User ID of the owner who added this book to the collection
  sharedWith: string[]; // Array of user IDs who have access to this book (for sharing)
  permissions: BookPermissions; // Granular permissions for the book

  createdAt: Date;
  updatedAt: Date;
}

// Book permissions - standard access control terminology
export interface BookPermissions {
  canView: boolean; // Can see the book in lists and details
  canEdit: boolean; // Can modify book details and metadata
  canLoan: boolean; // Can mark as loaned/returned
  canShare: boolean; // Can add other users to shared access
  canRemove: boolean; // Can delete from the collection
}

// Book ownership filtering options
export interface BookOwnershipFilter {
  // Filter by owner (who added the book)
  ownedBy?: string; // User ID

  // Filter by shared access (who has access)
  accessibleTo?: string | string[]; // Single user ID or array for multiple users

  // Filter by specific permissions
  withPermissions?: Partial<BookPermissions>;

  // Include books where user is the sole owner
  ownerOnly?: boolean;

  // Include shared books (sharedWith size > 0)
  sharedOnly?: boolean;
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

  // Ownership will be automatically set by the backend
  // ownerId: populated from authenticated user context
  // sharedWith: initialized as empty array by default
  // permissions: set to default owner permissions

  // Optional sharing configuration during creation
  shareWith?: string[]; // Additional user IDs to add to shared access
  initialPermissions?: Partial<BookPermissions>; // Custom permissions (defaults applied if not provided)
}

// Update Book DTO
export interface UpdateBookDto extends Partial<CreateBookDto> {
  loanStatus?: {
    isLoaned: boolean;
    loanedTo?: string;
    loanedDate?: Date;
    expectedReturnDate?: Date;
  };

  // Ownership updates (restricted based on user's permissions)
  sharedWith?: string[]; // Update shared access list (requires canShare permission)
  permissions?: Partial<BookPermissions>; // Update permissions (requires canShare permission)
}

// Share Book DTO for explicit sharing operations
export interface ShareBookDto {
  userIds: string[]; // Users to add to shared access
  permissions?: Partial<BookPermissions>; // Permissions to grant (defaults to view-only)
  message?: string; // Optional message for the shared users
}

// Default permissions for book owners and shared users
export const DEFAULT_OWNER_PERMISSIONS: BookPermissions = {
  canView: true,
  canEdit: true,
  canLoan: true,
  canShare: true,
  canRemove: true,
};

export const DEFAULT_SHARED_PERMISSIONS: BookPermissions = {
  canView: true,
  canEdit: false,
  canLoan: false,
  canShare: false,
  canRemove: false,
};

// Search and filter interfaces
export interface BookSearchCriteria {
  query?: string; // Search in title, author, isbn
  genre?: string;
  type?: 'reference' | 'personal';
  isFavourite?: boolean;
  isLoaned?: boolean;
  condition?: string;

  // Ownership-based filtering with standard terminology
  ownership?: BookOwnershipFilter;
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
