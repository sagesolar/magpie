// Request/Response validation schemas using Zod
import { z } from 'zod';

export const CreateBookSchema = z.object({
  isbn: z.string().min(10).max(13),
  title: z.string().min(1),
  authors: z.array(z.string()),
  publisher: z.string().min(1),
  edition: z.string().optional(),
  publishingYear: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear() + 1),
  pages: z.number().int().positive().optional(),
  genre: z.string().optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  goodreadsLink: z.string().url().optional(),
  physicalLocation: z.string().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  notes: z.string().optional(),
  isFavourite: z.boolean().optional(),
  type: z.enum(['reference', 'personal']),
});

export const UpdateBookSchema = CreateBookSchema.partial().extend({
  loanStatus: z
    .object({
      isLoaned: z.boolean(),
      loanedTo: z.string().optional(),
      loanedDate: z.date().optional(),
      expectedReturnDate: z.date().optional(),
    })
    .optional(),
});

export const BookSearchQuerySchema = z.object({
  query: z.string().optional(),
  genre: z.string().optional(),
  type: z.enum(['reference', 'personal']).optional(),
  isFavourite: z.boolean().optional(),
  isLoaned: z.boolean().optional(),
  condition: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortField: z.enum(['title', 'author', 'genre', 'publishingYear', 'createdAt']).default('title'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

export const IsbnParamSchema = z.object({
  isbn: z.string().min(10).max(13),
});

export const SyncBatchSchema = z.object({
  changes: z.array(
    z.object({
      operation: z.enum(['create', 'update', 'delete']),
      isbn: z.string(),
      data: z.union([CreateBookSchema, UpdateBookSchema]).optional(),
      timestamp: z.date(),
    })
  ),
});
