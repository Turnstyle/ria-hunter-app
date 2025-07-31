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
  title: z.string().min(5, { message: "Title must be at least 5 characters long" }),
  description: z.string().optional(),
  price: z.number().positive({ message: "Price must be a positive number" }),
  email: z.string().email({ message: "Invalid email address" }),
});

export type CreateListingPayload = z.infer<typeof CreateListingSchema>;

export const IdSchema = z.object({
  id: z.string().uuid({ message: "ID must be a valid UUID" }),
});

export const UpdateListingSchema = CreateListingSchema.partial().extend({
  id: z.string().uuid(),
});

export type UpdateListingPayload = z.infer<typeof UpdateListingSchema>;

// RIA Hunter specific schemas
export const RIASearchSchema = z.object({
  query: z.string().min(1, { message: "Search query cannot be empty" }),
  location: z.string().optional(),
  privateInvestment: z.boolean().optional(),
});

export type RIASearchPayload = z.infer<typeof RIASearchSchema>;

export const RIAProfileSchema = z.object({
  cik: z.number(),
  crd_number: z.number().nullable(),
  legal_name: z.string(),
  main_addr_street1: z.string().nullable(),
  main_addr_street2: z.string().nullable(),
  main_addr_city: z.string().nullable(),
  main_addr_state: z.string().nullable(),
  main_addr_zip: z.string().nullable(),
  main_addr_country: z.string().nullable(),
  phone_number: z.string().nullable(),
  fax_number: z.string().nullable(),
  website: z.string().nullable(),
});

export type RIAProfile = z.infer<typeof RIAProfileSchema>;
