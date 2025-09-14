// REST API Controller following clean architecture
import { Request, Response, NextFunction } from 'express';
import { BookUseCase } from '../application/book.usecase';
import {
  CreateBookSchema,
  UpdateBookSchema,
  BookSearchQuerySchema,
  IsbnParamSchema,
} from './validation.schemas';
import { getAuthenticatedUser, getUserId } from '../infrastructure/auth.middleware';

export class BookController {
  constructor(private bookUseCase: BookUseCase) {}

  // GET /books
  getAllBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedQuery = BookSearchQuerySchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        isFavourite: req.query.isFavourite ? req.query.isFavourite === 'true' : undefined,
        isLoaned: req.query.isLoaned ? req.query.isLoaned === 'true' : undefined,
      });

      const criteria = {
        query: validatedQuery.query,
        genre: validatedQuery.genre,
        type: validatedQuery.type,
        isFavourite: validatedQuery.isFavourite,
        isLoaned: validatedQuery.isLoaned,
        condition: validatedQuery.condition,
      };

      const sort = {
        field: validatedQuery.sortField,
        direction: validatedQuery.sortDirection,
      };

      const pagination = {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
      };

      // Get user ID from authenticated context (if available)
      const userId = getUserId(req) || undefined;

      const result = await this.bookUseCase.getAllBooks(criteria, sort, pagination, userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // GET /books/:isbn
  getBookByIsbn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { isbn } = IsbnParamSchema.parse(req.params);
      const userId = getUserId(req) || undefined;

      const book = await this.bookUseCase.getBookByIsbn(isbn, userId);

      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      res.json(book);
    } catch (error) {
      next(error);
    }
  };

  // POST /books (requires authentication)
  createBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const validatedData = CreateBookSchema.parse(req.body);

      const book = await this.bookUseCase.createBook(validatedData, user.id);
      res.status(201).json(book);
    } catch (error) {
      next(error);
    }
  };

  // PUT /books/:isbn (requires authentication)
  updateBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn } = IsbnParamSchema.parse(req.params);
      const validatedData = UpdateBookSchema.parse(req.body);

      const book = await this.bookUseCase.updateBook(isbn, validatedData, user.id);
      res.json(book);
    } catch (error) {
      next(error);
    }
  };

  // DELETE /books/:isbn (requires authentication)
  deleteBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn } = IsbnParamSchema.parse(req.params);

      await this.bookUseCase.deleteBook(isbn, user.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // GET /search
  searchBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const userId = getUserId(req) || undefined;
      const books = await this.bookUseCase.searchBooks(query, userId);
      res.json(books);
    } catch (error) {
      next(error);
    }
  };

  // GET /user/books (requires authentication) - Get user's personal collection
  getUserBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const includeShared = req.query.includeShared !== 'false'; // Default to true

      const books = await this.bookUseCase.getUserBooks(user.id, includeShared);
      res.json(books);
    } catch (error) {
      next(error);
    }
  };

  // POST /books/:isbn/share (requires authentication) - Share a book with other users
  shareBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn } = IsbnParamSchema.parse(req.params);
      const { userIds, rights, message } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: 'userIds must be a non-empty array' });
        return;
      }

      const shareData = {
        userIds,
        rights,
        message,
      };

      const book = await this.bookUseCase.shareBook(isbn, shareData, user.id);
      res.json(book);
    } catch (error) {
      next(error);
    }
  };

  // DELETE /books/:isbn/share/:userId (requires authentication) - Remove user from book
  removeUserFromBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn, userId: userIdToRemove } = req.params;

      if (!isbn || !userIdToRemove) {
        res.status(400).json({ error: 'ISBN and userId are required' });
        return;
      }

      const book = await this.bookUseCase.removeUserFromBook(isbn, userIdToRemove, user.id);
      res.json(book);
    } catch (error) {
      next(error);
    }
  };

  // GET /external/:isbn
  fetchExternalBookData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { isbn } = IsbnParamSchema.parse(req.params);
      const bookData = await this.bookUseCase.fetchExternalBookData(isbn);

      if (!bookData) {
        res.status(404).json({ error: 'Book data not found in external sources' });
        return;
      }

      res.json(bookData);
    } catch (error) {
      next(error);
    }
  };

  // PUT /books/:isbn/favourite (requires authentication)
  toggleFavourite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn } = IsbnParamSchema.parse(req.params);
      const { isFavourite } = req.body;

      if (typeof isFavourite !== 'boolean') {
        res.status(400).json({ error: 'isFavourite must be a boolean' });
        return;
      }

      const book = await this.bookUseCase.markAsFavourite(isbn, isFavourite, user.id);
      res.json(book);
    } catch (error) {
      next(error);
    }
  };

  // PUT /books/:isbn/loan (requires authentication)
  updateLoanStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getAuthenticatedUser(req);
      const { isbn } = IsbnParamSchema.parse(req.params);
      const { loanStatus } = req.body;

      if (!loanStatus || typeof loanStatus.isLoaned !== 'boolean') {
        res.status(400).json({ error: 'Invalid loan status data' });
        return;
      }

      const book = await this.bookUseCase.updateLoanStatus(isbn, loanStatus, user.id);
      res.json(book);
    } catch (error) {
      next(error);
    }
  };
}
