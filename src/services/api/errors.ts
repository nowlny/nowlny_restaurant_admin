import axios from "axios";

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function isApiNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function isApiStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status;
}
