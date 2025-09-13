// External book data service implementation
import fetch from 'node-fetch';
import { Book } from '../domain/book.types';
import { ExternalBookService } from './interfaces';
import { logger } from '../utils/logger';

// Type definitions for OpenLibrary API response
interface OpenLibraryAuthor {
  name: string;
}

interface OpenLibraryPublisher {
  name: string;
}

interface OpenLibrarySubject {
  name: string;
}

interface OpenLibraryCover {
  small?: string;
  medium?: string;
  large?: string;
}

interface OpenLibraryDescription {
  value?: string;
}

interface OpenLibraryBookData {
  title?: string;
  authors?: OpenLibraryAuthor[];
  publishers?: OpenLibraryPublisher[];
  publish_date?: string;
  number_of_pages?: number;
  description?: OpenLibraryDescription | string;
  cover?: OpenLibraryCover;
  subjects?: OpenLibrarySubject[];
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBookData;
}

export class ExternalBookServiceImpl implements ExternalBookService {
  private readonly apiEndpoints = [
    'https://openlibrary.org/api/books',
    // Add more APIs as needed
  ];

  async fetchBookByIsbn(isbn: string): Promise<Partial<Book> | null> {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');

    // Try OpenLibrary first
    try {
      const openLibraryData = await this.fetchFromOpenLibrary(cleanIsbn);
      if (openLibraryData) {
        return openLibraryData;
      }
    } catch (error) {
      logger.warn('OpenLibrary API failed');
      logger.debug(`OpenLibrary error: ${error}`);
    }

    // Add more API fallbacks here

    return null;
  }

  private async fetchFromOpenLibrary(isbn: string): Promise<Partial<Book> | null> {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as OpenLibraryResponse;
      const bookData = data[`ISBN:${isbn}`];

      if (!bookData) {
        return null;
      }

      return {
        title: bookData.title || '',
        authors: bookData.authors ? bookData.authors.map((author) => author.name) : [],
        publisher: bookData.publishers ? bookData.publishers[0]?.name || '' : '',
        publishingYear: bookData.publish_date ? this.extractYear(bookData.publish_date) : 0,
        pages: bookData.number_of_pages || undefined,
        description: typeof bookData.description === 'string' 
          ? bookData.description 
          : bookData.description?.value || undefined,
        coverImageUrl:
          bookData.cover?.large || bookData.cover?.medium || bookData.cover?.small || undefined,
        genre: bookData.subjects ? bookData.subjects[0]?.name : undefined,
      };
    } catch (error) {
      logger.error('Error fetching from OpenLibrary', error);
      return null;
    }
  }

  private extractYear(dateString: string): number {
    const yearMatch = dateString.match(/\d{4}/);
    return yearMatch ? parseInt(yearMatch[0], 10) : 0;
  }
}
