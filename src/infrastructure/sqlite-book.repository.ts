// SQLite implementation of BookRepository
import { Database } from 'sqlite3';
import { promisify } from 'util';
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

export class SqliteBookRepository implements BookRepository {
  private db: Database;

  constructor(dbPath: string = './books.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    const run = promisify(this.db.run.bind(this.db)) as any;

    await run(`
      CREATE TABLE IF NOT EXISTS books (
        isbn TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        authors TEXT NOT NULL, -- JSON array
        publisher TEXT NOT NULL,
        edition TEXT,
        publishing_year INTEGER NOT NULL,
        pages INTEGER,
        genre TEXT,
        description TEXT,
        cover_image_url TEXT,
        goodreads_link TEXT,
        physical_location TEXT,
        condition TEXT,
        notes TEXT,
        is_favourite BOOLEAN DEFAULT FALSE,
        type TEXT NOT NULL CHECK (type IN ('reference', 'personal')),
        loan_status TEXT, -- JSON object
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async create(bookData: CreateBookDto): Promise<Book> {
    const run = promisify(this.db.run.bind(this.db)) as any;
    const now = new Date();

    const book: Book = {
      ...bookData,
      isFavourite: bookData.isFavourite ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await run(
      `
      INSERT INTO books (
        isbn, title, authors, publisher, edition, publishing_year, pages,
        genre, description, cover_image_url, goodreads_link, physical_location,
        condition, notes, is_favourite, type, loan_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        book.isbn,
        book.title,
        JSON.stringify(book.authors),
        book.publisher,
        book.edition,
        book.publishingYear,
        book.pages,
        book.genre,
        book.description,
        book.coverImageUrl,
        book.goodreadsLink,
        book.physicalLocation,
        book.condition,
        book.notes,
        book.isFavourite,
        book.type,
        book.loanStatus ? JSON.stringify(book.loanStatus) : null,
        book.createdAt.toISOString(),
        book.updatedAt.toISOString(),
      ]
    );

    return book;
  }

  async findById(isbn: string): Promise<Book | null> {
    const get = promisify(this.db.get.bind(this.db)) as any;

    const row = (await get('SELECT * FROM books WHERE isbn = ?', [isbn])) as any;

    return row ? this.mapRowToBook(row) : null;
  }

  async findAll(
    criteria?: BookSearchCriteria,
    sort?: BookSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Book>> {
    const all = promisify(this.db.all.bind(this.db)) as any;
    const get = promisify(this.db.get.bind(this.db)) as any;

    let whereClause = '';
    let params: any[] = [];

    if (criteria) {
      const conditions: string[] = [];

      if (criteria.query) {
        conditions.push('(title LIKE ? OR authors LIKE ? OR isbn LIKE ?)');
        const searchTerm = `%${criteria.query}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (criteria.genre) {
        conditions.push('genre = ?');
        params.push(criteria.genre);
      }

      if (criteria.type) {
        conditions.push('type = ?');
        params.push(criteria.type);
      }

      if (criteria.isFavourite !== undefined) {
        conditions.push('is_favourite = ?');
        params.push(criteria.isFavourite);
      }

      if (criteria.isLoaned !== undefined) {
        if (criteria.isLoaned) {
          conditions.push(
            'loan_status IS NOT NULL AND json_extract(loan_status, "$.isLoaned") = 1'
          );
        } else {
          conditions.push('(loan_status IS NULL OR json_extract(loan_status, "$.isLoaned") = 0)');
        }
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }
    }

    // Count total records
    const countResult = (await get(
      `SELECT COUNT(*) as total FROM books ${whereClause}`,
      params
    )) as any;
    const total = countResult.total;

    // Build ORDER BY clause
    let orderClause = '';
    if (sort) {
      const columnMap: Record<string, string> = {
        title: 'title',
        author: 'authors',
        genre: 'genre',
        publishingYear: 'publishing_year',
        createdAt: 'created_at',
      };

      const column = columnMap[sort.field] || 'title';
      orderClause = `ORDER BY ${column} ${sort.direction.toUpperCase()}`;
    }

    // Build LIMIT clause
    let limitClause = '';
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      limitClause = `LIMIT ${pagination.limit} OFFSET ${offset}`;
    }

    const query = `SELECT * FROM books ${whereClause} ${orderClause} ${limitClause}`;
    const rows = (await all(query, params)) as any[];

    const books = rows.map(row => this.mapRowToBook(row));

    const totalPages = pagination ? Math.ceil(total / pagination.limit) : 1;

    return {
      data: books,
      total,
      page: pagination?.page || 1,
      limit: pagination?.limit || total,
      totalPages,
    };
  }

  async update(isbn: string, updates: UpdateBookDto): Promise<Book | null> {
    const run = promisify(this.db.run.bind(this.db)) as any;

    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const columnMap: Record<string, string> = {
          title: 'title',
          authors: 'authors',
          publisher: 'publisher',
          edition: 'edition',
          publishingYear: 'publishing_year',
          pages: 'pages',
          genre: 'genre',
          description: 'description',
          coverImageUrl: 'cover_image_url',
          goodreadsLink: 'goodreads_link',
          physicalLocation: 'physical_location',
          condition: 'condition',
          notes: 'notes',
          isFavourite: 'is_favourite',
          type: 'type',
          loanStatus: 'loan_status',
        };

        const column = columnMap[key];
        if (column) {
          fields.push(`${column} = ?`);
          if (key === 'authors' || key === 'loanStatus') {
            params.push(JSON.stringify(value));
          } else {
            params.push(value);
          }
        }
      }
    });

    if (fields.length === 0) {
      return this.findById(isbn);
    }

    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(isbn);

    await run(`UPDATE books SET ${fields.join(', ')} WHERE isbn = ?`, params);

    return this.findById(isbn);
  }

  async delete(isbn: string): Promise<boolean> {
    const run = promisify(this.db.run.bind(this.db)) as any;

    const result = await run('DELETE FROM books WHERE isbn = ?', [isbn]);
    return (result as any).changes > 0;
  }

  async search(query: string): Promise<Book[]> {
    const all = promisify(this.db.all.bind(this.db)) as any;

    const rows = (await all(
      `
      SELECT * FROM books 
      WHERE title LIKE ? OR authors LIKE ? OR isbn LIKE ? 
      ORDER BY title
    `,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    )) as any[];

    return rows.map(row => this.mapRowToBook(row));
  }

  private mapRowToBook(row: any): Book {
    return {
      isbn: row.isbn,
      title: row.title,
      authors: JSON.parse(row.authors),
      publisher: row.publisher,
      edition: row.edition,
      publishingYear: row.publishing_year,
      pages: row.pages,
      genre: row.genre,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      goodreadsLink: row.goodreads_link,
      physicalLocation: row.physical_location,
      condition: row.condition,
      notes: row.notes,
      isFavourite: Boolean(row.is_favourite),
      type: row.type,
      loanStatus: row.loan_status ? JSON.parse(row.loan_status) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
