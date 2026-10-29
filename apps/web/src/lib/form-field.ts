/** A text field of a submitted form; `''` when it is missing or a file. */
export function formField(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
