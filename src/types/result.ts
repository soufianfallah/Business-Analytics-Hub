export type Result<TData, TError = string> =
  { success: true; data: TData } | { success: false; error: TError };
