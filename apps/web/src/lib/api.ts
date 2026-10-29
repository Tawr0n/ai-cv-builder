import { apiErrorSchema, type ApiError } from '@ai-cv-builder/shared';
import type { z } from 'zod';

/** A non-2xx answer from the API, carrying its stable error `code`. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError['error'],
  ) {
    super(error.message);
  }
}

type ApiPath = `/api/${string}`;

async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: ApiPath,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<unknown> {
  // A FormData body goes as multipart; fetch sets its content-type with the boundary.
  const isForm = body instanceof FormData;
  const response = await fetch(path, {
    method,
    headers: {
      accept: 'application/json',
      ...(body !== undefined &&
        !isForm && { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body !== undefined && { body: isForm ? body : JSON.stringify(body) }),
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) throw requestError(response, payload);
  return payload;
}

function requestError(response: Response, payload: unknown) {
  const parsed = apiErrorSchema.safeParse(payload);
  return new ApiRequestError(
    response.status,
    parsed.success
      ? parsed.data.error
      : { code: 'unexpected_response', message: response.statusText },
  );
}

/** GETs a file (e.g. the CV's PDF) with its suggested name from `Content-Disposition`. */
export async function apiDownload(
  path: ApiPath,
  fallbackName: string,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(path);
  if (!response.ok) {
    throw requestError(response, await response.json().catch(() => undefined));
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  return {
    blob: await response.blob(),
    fileName: encoded ? decodeURIComponent(encoded) : fallbackName,
  };
}

/** Calls the API through the Next.js `/api/*` rewrite and parses the answer with a shared schema. */
export async function apiGet<Schema extends z.ZodType>(
  path: ApiPath,
  schema: Schema,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest('GET', path));
}

/** POSTs JSON; `schema` parses the answer, or pass `undefined` for an empty `204`. */
export async function apiPost<Schema extends z.ZodType>(
  path: ApiPath,
  body: unknown,
  schema: Schema,
): Promise<z.output<Schema>>;
export async function apiPost(path: ApiPath, body?: unknown): Promise<void>;
export async function apiPost(
  path: ApiPath,
  body?: unknown,
  schema?: z.ZodType,
): Promise<unknown> {
  const payload = await apiRequest('POST', path, body);
  return schema ? schema.parse(payload) : undefined;
}

/** PATCHes JSON and parses the answer with a shared schema. */
export async function apiPatch<Schema extends z.ZodType>(
  path: ApiPath,
  body: unknown,
  schema: Schema,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest('PATCH', path, body));
}

/** DELETEs and parses the answer with a shared schema. */
export async function apiDelete<Schema extends z.ZodType>(
  path: ApiPath,
  schema: Schema,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest('DELETE', path));
}

/** POSTs a multipart form (e.g. a file upload) with extra headers and parses the answer. */
export async function apiPostForm<Schema extends z.ZodType>(
  path: ApiPath,
  form: FormData,
  headers: Record<string, string>,
  schema: Schema,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest('POST', path, form, headers));
}
