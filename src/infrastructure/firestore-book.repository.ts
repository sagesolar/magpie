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
} from '../domain/book.types';
import { BookRepository } from './interfaces';

export class FirestoreBookRepository implements BookRepository {
  private db: Firestore;
  private collection: CollectionReference<DocumentData>;

  constructor(projectId?: string, serviceAccountPath?: string, databaseId?: string) {
    const dbId = databaseId || process.env.FIRESTORE_DATABASE_ID || '(default)';
    const project = projectId || process.env.GOOGLE_CLOUD_PROJECT_ID;

    console.log(`Connecting to Firestore - Project: ${project}, Database: ${dbId}`);

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
    return {
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
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
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

  async create(book: CreateBookDto): Promise<Book> {
    const bookData = this.bookToFirestore(book);
    bookData.createdAt = FieldValue.serverTimestamp();

    const docRef = this.collection.doc(book.isbn);
    await docRef.set(bookData);

    // Fetch the created document to get server timestamps
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error('Failed to create book');
    }

    return this.firestoreToBook(doc.id, doc.data()!);
  }

  async findById(isbn: string): Promise<Book | null> {
    const doc = await this.collection.doc(isbn).get();

    if (!doc.exists) {
      return null;
    }

    return this.firestoreToBook(doc.id, doc.data()!);
  }

  async findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Book>> {
    let query: Query<DocumentData> = this.collection;

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
    const books = snapshot.docs.map(doc => this.firestoreToBook(doc.id, doc.data()));

    // Apply text search filter (Firestore doesn't have full-text search built-in)
    let filteredBooks = books;
    if (criteria?.query) {
      const searchTerm = criteria.query.toLowerCase();
      filteredBooks = books.filter(
        book =>
          book.title.toLowerCase().includes(searchTerm) ||
          book.authors.some(author => author.toLowerCase().includes(searchTerm)) ||
          book.isbn.toLowerCase().includes(searchTerm) ||
          book.publisher.toLowerCase().includes(searchTerm) ||
          (book.genre && book.genre.toLowerCase().includes(searchTerm))
      );
    }

    // Get total count (this is expensive in Firestore, consider using a counter document)
    const totalSnapshot = await this.collection.get();
    const total = totalSnapshot.size;

    return {
      data: filteredBooks,
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || 10,
      totalPages: Math.ceil(total / (pagination?.limit || 10)),
    };
  }

  async update(isbn: string, updates: UpdateBookDto): Promise<Book | null> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const updateData = this.bookToFirestore(updates);
    await docRef.update(updateData);

    // Fetch updated document
    const updatedDoc = await docRef.get();
    return this.firestoreToBook(updatedDoc.id, updatedDoc.data()!);
  }

  async delete(isbn: string): Promise<boolean> {
    const docRef = this.collection.doc(isbn);
    const doc = await docRef.get();

    if (!doc.exists) {
      return false;
    }

    await docRef.delete();
    return true;
  }

  async search(query: string): Promise<Book[]> {
    // Since Firestore doesn't have built-in full-text search,
    // we'll fetch all documents and filter client-side
    // For production, consider using Algolia or Elasticsearch
    const snapshot = await this.collection.get();
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

  // Optional: Close connection (Firestore handles this automatically)
  async close(): Promise<void> {
    // Firestore connections are managed automatically
    // This method is kept for interface compatibility
  }
}
