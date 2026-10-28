/** Presentation helpers. No component formats a number or date by hand. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const currencyWithCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatPrice(value: number): string {
  // Whole-dollar prices read better without ".00" on a card.
  return Number.isInteger(value) ? currency.format(value) : currencyWithCents.format(value);
}

export function formatDate(iso: string): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC); make it an ISO instant first.
  const normalised = iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`;
  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** "SEDAN" -> "Sedan", for display without losing the canonical value. */
export function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

/** Initials for the avatar chip in the navbar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
