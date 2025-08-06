import { z } from 'zod';

// Base schemas for common fields
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// API specific schemas
export const CreateListingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  description: z.string().optional(),
  price: z.number().positive('Price must be a positive number'),
  category: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),
});

export const UpdateListingSchema = CreateListingSchema.partial();

export const ListingFilterSchema = z.object({
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  tags: z.array(z.string()).optional(),
  ...PaginationSchema.shape,
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  status: z.string(),
  plan_id: z.string(),
  current_period_start: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
});


// Types derived from schemas
export type CreateListingDTO = z.infer<typeof CreateListingSchema>;
export type UpdateListingDTO = z.infer<typeof UpdateListingSchema>;
export type ListingFilterDTO = z.infer<typeof ListingFilterSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
