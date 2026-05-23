import { NextResponse } from "next/server";
import type { ZodError } from "zod";

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null, status }, { status });
}

export function err(message: string, status: number): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ data: null, error: message, status }, { status });
}

export function validationErr(zodError: ZodError): NextResponse<ApiResponse<null>> {
  const issue = zodError.issues[0];
  const field = issue.path.join(".");
  const message = field ? `${field}: ${issue.message}` : issue.message;
  return err(message, 400);
}
