// Firestore implementation of BookRepository
import {
  Firestore,
  CollectionReference,
  DocumentData,
  QuerySnapshot,
  FieldValue,
  Query,
} from '@google-cloud/firestore';
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
} from '../domain/book.types';
import { BookRepository } from './interfaces';

export class FirestoreBookRepository implements BookRepository {
  private db: Firestore;
  private collection: CollectionReference<DocumentData>;

  // Add firestoreInstance property for server.ts compatibility
  public get firestoreInstance(): Firestore {
    return this.db;
  }

  constructor(projectId?: string, serviceAccountPath?: string, databaseId?: string) {
    const dbId = databaseId || process.env.FIRESTORE_DATABASE_ID || '(default)';
    const project = projectId || process.env.GOOGLE_CLOUD_PROJECT_ID;

    // Use @google-cloud/firestore directly for named database support
    this.db = new Firestore({
      projectId: project,
      databaseId: dbId,
    });

    this.collection = this.db.collection('books');

    // Configure additional Firestore settings
    this.db.settings({
      ignoreUndefinedProperties: true,
    });
  }

  private firestoreToBook(id: string, data: DocumentData): Book {
    console.log(`[DEBUG] Converting book: ${data.title} (${id})`);
    
    const book: Book = {
      isbn: id,
      title: data.title,
      authors: data.authors || [],
      publisher: data.publisher,
      edition: data.edition,
      publishingYear: data.publishingYear,
      pages: data.pages,
      genre: data.genre,
      description: data.description,
      coverImageUrl: data.coverImageUrl,
      goodreadsLink: data.goodreadsLink,
      physicalLocation: data.physicalLocation,
      condition: data.condition,
      notes: data.notes,
      isFavourite: data.isFavourite || false,
      type: data.type,
      loanStatus: data.loanStatus,
      ownerId: data.ownerId,
      sharedWith: data.sharedWith || [],
      permissions: data.permissions || DEFAULT_OWNER_PERMISSIONS,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
    
    console.log(`[DEBUG] Converted book successfully: ${book.title}`);
    return book;
  }

  private bookToFirestore(book: CreateBookDto | UpdateBookDto): DocumentData {
    const data: DocumentData = {
      ...book,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Add createdAt only for new books
    if ('isbn' in book) {
      data.createdAt = FieldValue.serverTimestamp();
    }

    // Remove undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    return data;
  }

  async create(book: CreateBookDto, userId: string): Promise<Book> {
    const bookData = this.bookToFirestore(book);
    bookData.createdAt = FieldValue.serverTimestamp();
    bookData.ownerId = userId; // Set the owner

    const docRef = this.collection.doc(book.isbn);
    await docRef.set(bookData);

    // Fetch the created document to get server timestamps
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Failed to create book');
    }

    return this.firestoreToBook(doc.id, doc.data()!);
  }

  async findById(isbn: string, userId?: string): Promise<Book | null> {
    const doc = await this.collection.doc(isbn).get();

    if (!doc.exists) {
      return null;
    }

    const book = this.firestoreToBook(doc.id, doc.data()!);

    // If userId is provided, check if user has access to the book
    if (userId && book.ownerId !== userId && !book.sharedWith?.includes(userId)) {
      return null; // User doesn't have access to this book
    }

    return book;
  }

  async findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions,
    userId?: string
  ): Promise<PaginatedResult<Book>> {
    console.log(`[DEBUG] findAll called with userId: ${userId}`);
    console.log(`[DEBUG] findAll called with criteria:`, JSON.stringify(criteria, null, 2));
    console.log(`[DEBUG] findAll called with sort:`, JSON.stringify(sort, null, 2));
    console.log(`[DEBUG] findAll called with pagination:`, JSON.stringify(pagination, null, 2));
    
    let query: Query<DocumentData> = this.collection;

    // Apply ownership filtering first
    if (userId) {
      console.log(`[DEBUG] Applying ownerId filter for user: ${userId}`);
      query = query.where('ownerId', '==', userId);
      // TODO: Also include books shared with this user - requires compound query
    } else {
      console.log(`[DEBUG] No userId provided, querying all books`);
    }

    // Apply filters
    if (criteria?.genre) {
      query = query.where('genre', '==', criteria.genre);
    }

    if (criteria?.type) {
      query = query.where('type', '==', criteria.type);
    }

    if (criteria?.isFavourite !== undefined) {
      query = query.where('isFavourite', '==', criteria.isFavourite);
    }

    // Apply sorting
    if (sort?.field) {
      const direction = sort.direction === 'desc' ? 'desc' : 'asc';
      query = query.orderBy(sort.field, direction);
    } else {
      // Default sort by createdAt
      query = query.orderBy('createdAt', 'desc');
    }

    // Apply pagination
    if (pagination?.limit) {
      query = query.limit(pagination.limit);
    }

    if (pagination?.page && pagination.page > 1 && pagination?.limit) {
      const offset = (pagination.page - 1) * pagination.limit;
      query = query.offset(offset);
    }

    const snapshot: QuerySnapshot = await query.get();
    console.log(`[DEBUG] Firestore query returned ${snapshot.docs.length} documents`);
    
    const books = snapshot.docs.map(doc => {
      const bookData = this.firestoreToBook(doc.id, doc.data());
      console.log(`[DEBUG] Book found: ${bookData.title} (ISBN: ${bookData.isbn}, ownerId: ${bookData.ownerId})`);
      return bookData;
    });

    // Apply text search filter (Firestore doesn't have full-text search built-in)
    let filteredBooks = books;
    if (criteria?.query) {
      const searchTerm = criteria.query.toLowerCase();
      console.log(`[DEBUG] Applying text search filter for: "${searchTerm}"`);
      filteredBooks = books.filter(
        book =>
          book.title.toLowerCase().includes(searchTerm) ||
          book.authors.some(author => author.toLowerCase().includes(searchTerm)) ||
          book.isbn.toLowerCase().includes(searchTerm) ||
          book.publisher.toLowerCase().includes(searchTerm) ||
          (book.genre && book.genre.toLowerCase().includes(searchTerm))
      );
      console.log(`[DEBUG] Text search filtered books to ${filteredBooks.length} results`);
    }

    // Get total count (this is expensive in Firestore, consider using a counter document)
    console.log(`[DEBUG] Getting total count for all books in collection`);
    const totalSnapshot = await this.collection.get();
    const total = totalSnapshot.size;
    console.log(`[DEBUG] Total books in collection: ${total}`);

    console.log(`[DEBUG] Final result: ${filteredBooks.length} books returned, page: ${pagination?.page || 1}, limit: ${pagination?.limit || 20}`);

    return {
      data: filteredBooks,
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      totalPages: Math.ceil(total / (pagination?.limit || 10)),
    };
  }

  async update(isbn: string, updates: UpdateBookDto, userId: string): Promise<Book | null> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const existingBook = this.firestoreToBook(doc.id, doc.data()!);

    // Check if user has permission to update
    if (existingBook.ownerId !== userId && !existingBook.sharedWith?.includes(userId)) {
      throw new Error('Unauthorized: You do not have permission to update this book');
    }

    const updateData = this.bookToFirestore(updates);
    await docRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await docRef.get();
    return this.firestoreToBook(updatedDoc.id, updatedDoc.data()!);
  }

  async delete(isbn: string, userId: string): Promise<boolean> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    const existingBook = this.firestoreToBook(doc.id, doc.data()!);

    // Check if user has permission to delete (only owner can delete)
    if (existingBook.ownerId !== userId) {
      throw new Error('Unauthorized: Only the owner can delete this book');
    }

    await docRef.delete();
    return true;
  }

  async search(query: string, userId?: string): Promise<Book[]> {
    // Since Firestore doesn't have built-in full-text search,
    // we'll fetch all documents and filter client-side
    // For production, consider using Algolia or Elasticsearch
    let queryRef: Query<DocumentData> = this.collection;

    // If userId provided, filter by ownership first
    if (userId) {
      queryRef = this.collection.where('ownerId', '==', userId);
    }

    const snapshot = await queryRef.get();
    const allBooks = snapshot.docs.map(doc => this.firestoreToBook(doc.id, doc.data()));

    const searchTerm = query.toLowerCase();
    return allBooks.filter(
      book =>
        book.title.toLowerCase().includes(searchTerm) ||
        book.authors.some(author => author.toLowerCase().includes(searchTerm)) ||
        book.isbn.toLowerCase().includes(searchTerm) ||
        book.publisher.toLowerCase().includes(searchTerm) ||
        (book.genre && book.genre.toLowerCase().includes(searchTerm)) ||
        (book.description && book.description.toLowerCase().includes(searchTerm))
    );
  }

  async shareBook(isbn: string, shareData: ShareBookDto, userId: string): Promise<Book | null> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const existingBook = this.firestoreToBook(doc.id, doc.data()!);

    // Check if user has permission to share (only owner can share)
    if (existingBook.ownerId !== userId) {
      throw new Error('Unauthorized: Only the owner can share this book');
    }

    // Add the users to sharedWith array if not already present
    const updatedSharedWith = [...existingBook.sharedWith];
    shareData.userIds.forEach(userId => {
      if (!updatedSharedWith.includes(userId)) {
        updatedSharedWith.push(userId);
      }
    });

    await docRef.update({
      sharedWith: updatedSharedWith,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return updated book
    const updatedDoc = await docRef.get();
    return this.firestoreToBook(updatedDoc.id, updatedDoc.data()!);
  }

  async removeUserFromBook(
    isbn: string,
    userIdToRemove: string,
    requestingUserId: string
  ): Promise<Book | null> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const existingBook = this.firestoreToBook(doc.id, doc.data()!);

    // Check if requesting user has permission (only owner can remove users)
    if (existingBook.ownerId !== requestingUserId) {
      throw new Error('Unauthorized: Only the owner can remove users from this book');
    }

    // Remove the user from sharedWith array
    const updatedSharedWith = existingBook.sharedWith.filter(userId => userId !== userIdToRemove);

    await docRef.update({
      sharedWith: updatedSharedWith,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Return updated book
    const updatedDoc = await docRef.get();
    return this.firestoreToBook(updatedDoc.id, updatedDoc.data()!);
  }

  async getUserBooks(userId: string, includeShared?: boolean): Promise<Book[]> {
    // Get books owned by the user
    const ownedQuery = this.collection.where('ownerId', '==', userId);
    const ownedSnapshot = await ownedQuery.get();
    const ownedBooks = ownedSnapshot.docs.map(doc => this.firestoreToBook(doc.id, doc.data()));

    if (!includeShared) {
      return ownedBooks;
    }

    // Get books shared with the user
    const sharedQuery = this.collection.where('sharedWith', 'array-contains', userId);
    const sharedSnapshot = await sharedQuery.get();
    const sharedBooks = sharedSnapshot.docs.map(doc => this.firestoreToBook(doc.id, doc.data()));

    // Combine and deduplicate (in case a user owns a book that's also shared with them)
    const allBooks = [...ownedBooks];
    sharedBooks.forEach(book => {
      if (!allBooks.find(existing => existing.isbn === book.isbn)) {
        allBooks.push(book);
      }
    });

    return allBooks;
  }

  // Optional: Close connection (Firestore handles this automatically)
  async close(): Promise<void> {
    // Firestore connections are managed automatically
    // This method is kept for interface compatibility
  }
}
