import { z } from 'zod';

export const CreateListingSchema = z.object({
  title: z.string().min(5, { message: "Title must be at least 5 characters long" }),
  description: z.string().optional(),
  price: z.number().positive({ message: "Price must be a positive number" }),
  email: z.string().email({ message: "Invalid email address" }),
});

export type CreateListingPayload = z.infer<typeof CreateListingSchema>;

export const IdSchema = z.object({
  id: z.string().uuid({ message: "ID must be a valid UUID" }), // Assuming IDs are UUIDs, adjust if different
});

export const UpdateListingSchema = CreateListingSchema.partial();

export type UpdateListingPayload = z.infer<typeof UpdateListingSchema>;
