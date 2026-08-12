import { ClientResponseError } from "pocketbase";

export function pbErrorMessage(err: unknown): string {
  if (err instanceof ClientResponseError) {
    const fieldErrors = Object.entries(err.response?.data ?? {})
      .map(([field, info]) => `${field}: ${(info as { message?: string }).message}`)
      .join(", ");
    return fieldErrors || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
