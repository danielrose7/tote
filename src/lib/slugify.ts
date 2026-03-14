/**
 * Convert a string to a URL-safe slug.
 * Preserves alphanumeric, hyphens, underscores, dots, and tildes.
 * Replaces spaces and unsafe chars with hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-_\.~\s]/g, "") // remove unsafe chars (keep spaces for now)
    .replace(/[\s]+/g, "-") // spaces to hyphens
    .replace(/-{2,}/g, "-") // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ""); // trim hyphens from ends
}

/**
 * Return a unique slug by appending -2, -3, etc. on collision.
 */
export function getUniqueSlug(
  desired: string,
  existingSlugs: string[]
): string {
  const base = slugify(desired);
  if (!existingSlugs.includes(base)) return base;

  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}
