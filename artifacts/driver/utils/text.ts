export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
