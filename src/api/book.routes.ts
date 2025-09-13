// Express routes for the Book API
import { Router } from 'express';
import { BookController } from './book.controller';

export function createBookRoutes(bookController: BookController): Router {
  const router = Router();

  // Book CRUD operations
  router.get('/books', bookController.getAllBooks);
  router.get('/books/:isbn', bookController.getBookByIsbn);
  router.post('/books', bookController.createBook);
  router.put('/books/:isbn', bookController.updateBook);
  router.delete('/books/:isbn', bookController.deleteBook);

  // Search functionality
  router.get('/search', bookController.searchBooks);

  // External book data
  router.get('/external/:isbn', bookController.fetchExternalBookData);

  // Special operations
  router.put('/books/:isbn/favourite', bookController.toggleFavourite);
  router.put('/books/:isbn/loan', bookController.updateLoanStatus);

  return router;
}
