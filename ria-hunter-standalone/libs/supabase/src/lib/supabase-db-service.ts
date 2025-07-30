import { supabase } from './supabase-client';

// Example: A service for a hypothetical "todos" table
// You'll need to adapt this to your actual Supabase schema

export interface Todo {
  id?: string;
  title: string;
  description?: string;
  is_complete: boolean;
  user_id?: string;
  created_at?: string;
}

export const TodoService = {
  /**
   * Get all todos for a specific user
   */
  async getAllTodos(userId: string): Promise<Todo[]> {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching todos:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get a specific todo by ID
   */
  async getTodoById(id: string): Promise<Todo | null> {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching todo with id ${id}:`, error);
      throw error;
    }

    return data;
  },

  /**
   * Create a new todo
   */
  async createTodo(todo: Omit<Todo, 'id' | 'created_at'>): Promise<Todo> {
    const { data, error } = await supabase
      .from('todos')
      .insert([todo])
      .select()
      .single();

    if (error) {
      console.error('Error creating todo:', error);
      throw error;
    }

    return data;
  },

  /**
   * Update an existing todo
   */
  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    const { data, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating todo with id ${id}:`, error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a todo
   */
  async deleteTodo(id: string): Promise<void> {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting todo with id ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle the completion status of a todo
   */
  async toggleTodoCompletion(id: string, currentStatus: boolean): Promise<Todo> {
    return this.updateTodo(id, { is_complete: !currentStatus });
  }
};

// Example: Real-time subscription
export const setupTodoSubscription = (
  userId: string,
  callback: (payload: { new: Todo; old: Todo; eventType: 'INSERT' | 'UPDATE' | 'DELETE' }) => void
) => {
  const subscription = supabase
    .channel('todos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload as any);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
};
