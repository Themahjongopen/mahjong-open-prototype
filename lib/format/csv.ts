// Escape a single CSV field: wrap it in double quotes when it contains a comma,
// quote, CR, or LF, doubling any embedded quotes. Shared by the admin
// Registrations export and the commissioner roster export (previously each kept
// its own copy).
export function csvField(value: string | null | undefined): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
