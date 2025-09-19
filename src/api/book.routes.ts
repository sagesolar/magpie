// Express routes for the Book API
import { Router } from 'express';
import { BookController } from './book.controller';
import { AuthenticationMiddleware } from '../infrastructure/auth.middleware';

export function createBookRoutes(
  bookController: BookController,
  authMiddleware: AuthenticationMiddleware
): Router {
  const router = Router();

  // Protected read routes (require authentication for user book data)
  router.get('/books', authMiddleware.requireAuth(), bookController.getAllBooks);
  router.get('/books/:isbn', authMiddleware.requireAuth(), bookController.getBookByIsbn);
  router.get('/search', authMiddleware.requireAuth(), bookController.searchBooks);
  router.get(
    '/external/:isbn',
    authMiddleware.requireAuth(),
    bookController.fetchExternalBookData
  );

  // Protected routes (require authentication)
  router.post('/books', authMiddleware.requireAuth(), bookController.createBook);
  router.put('/books/:isbn', authMiddleware.requireAuth(), bookController.updateBook);
  router.delete('/books/:isbn', authMiddleware.requireAuth(), bookController.deleteBook);

  // User-specific routes (require authentication)
  router.get('/user/books', authMiddleware.requireAuth(), bookController.getUserBooks);
  router.post('/books/:isbn/share', authMiddleware.requireAuth(), bookController.shareBook);
  router.delete(
    '/books/:isbn/share/:userId',
    authMiddleware.requireAuth(),
    bookController.removeUserFromBook
  );

  // Special operations (require authentication)
  router.put(
    '/books/:isbn/favourite',
    authMiddleware.requireAuth(),
    bookController.toggleFavourite
  );
  router.put('/books/:isbn/loan', authMiddleware.requireAuth(), bookController.updateLoanStatus);

  return router;
}
