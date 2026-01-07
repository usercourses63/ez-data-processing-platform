import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface OptimisticMutationOptions<TData, TVariables, TContext = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: readonly any[];
  updateFn: (old: any, variables: TVariables) => any;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: any, variables: TVariables, context: TContext | undefined) => void;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Custom hook for optimistic mutations with automatic rollback on error
 * Provides instant UI feedback while the mutation is in progress
 */
export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
  mutationFn,
  queryKey,
  updateFn,
  onSuccess,
  onError,
  successMessage,
  errorMessage
}: OptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    // Optimistically update the cache before the mutation completes
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return updateFn(old, variables);
      });

      // Return context object with the snapshotted value
      return { previousData } as TContext;
    },

    // If the mutation fails, use the context to roll back
    onError: (error, variables, context) => {
      if (context && typeof context === 'object' && context !== null && 'previousData' in context) {
        queryClient.setQueryData(queryKey, (context as any).previousData);
      }

      console.error('Mutation failed:', error);
      onError?.(error, variables, context);

      // Show error message if provided
      if (errorMessage) {
        // Import message from antd when needed
        console.error(errorMessage);
      }
    },

    // Always refetch after error or success to ensure we're in sync with the server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },

    // On success, call custom success handler
    onSuccess: (data, variables, context) => {
      onSuccess?.(data, variables, context);

      // Show success message if provided
      if (successMessage) {
        console.log(successMessage);
      }
    }
  });
}

/**
 * Optimistic delete mutation - removes item from list immediately
 */
export function useOptimisticDelete<T extends { id?: string; ID?: string }>(
  deleteFn: (id: string) => Promise<void>,
  queryKey: readonly any[],
  successMessage?: string,
  errorMessage?: string
) {
  return useOptimisticMutation({
    mutationFn: deleteFn,
    queryKey,
    updateFn: (old: any, id: string) => {
      // Handle both PagedResponse and array formats
      if (old.Items || old.items) {
        const items = old.Items || old.items;
        const filtered = items.filter((item: T) =>
          (item.id || item.ID) !== id
        );
        return old.Items
          ? { ...old, Items: filtered, TotalItems: (old.TotalItems || 0) - 1 }
          : { ...old, items: filtered, totalItems: (old.totalItems || 0) - 1 };
      }
      // Handle plain array
      return old.filter((item: T) => (item.id || item.ID) !== id);
    },
    successMessage,
    errorMessage
  });
}

/**
 * Optimistic update mutation - updates item in list immediately
 */
export function useOptimisticUpdate<T extends { id?: string; ID?: string }>(
  updateFn: (id: string, data: Partial<T>) => Promise<T>,
  queryKey: readonly any[],
  successMessage?: string,
  errorMessage?: string
) {
  return useOptimisticMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => updateFn(id, data),
    queryKey,
    updateFn: (old: any, { id, data }: { id: string; data: Partial<T> }) => {
      // Handle both PagedResponse and array formats
      if (old.Items || old.items) {
        const items = old.Items || old.items;
        const updated = items.map((item: T) =>
          (item.id || item.ID) === id ? { ...item, ...data } : item
        );
        return old.Items
          ? { ...old, Items: updated }
          : { ...old, items: updated };
      }
      // Handle plain array
      return old.map((item: T) =>
        (item.id || item.ID) === id ? { ...item, ...data } : item
      );
    },
    successMessage,
    errorMessage
  });
}
