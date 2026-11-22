import { ApiError } from "../api/client";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "../components/Toast";

/**
 * A mutation that toasts its outcome and refreshes the given queries on success: the shape of
 * every save, delete and set-current button in the panel.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  options: { invalidate: QueryKey[]; success: (args: TArgs, result: TResult) => string; onDone?: () => void },
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      toast.success(options.success(args, result));
      for (const key of options.invalidate) queryClient.invalidateQueries({ queryKey: key });
      options.onDone?.();
    },
    onError: (error) => toast.error(error),
  });
}

/**
 * Deleting a row that others still reference fails a foreign key, which the backend's
 * GlobalExceptionHandler reports as 409 "Duplicate entry". Say what it actually means.
 */
export async function deleteOrExplain<T>(remove: () => Promise<T>, what: string): Promise<T> {
  try {
    return await remove();
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(409, `${what} is still in use by other records, so it can't be deleted. Set it Inactive instead.`);
    }
    throw error;
  }
}
