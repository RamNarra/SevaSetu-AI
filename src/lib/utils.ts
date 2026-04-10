// Utility functions for SevaSetu AI

/**
 * Merge class names (simple implementation without clsx dependency)
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | { toDate: () => Date } | undefined): string {
  if (!date) return 'N/A';
  const d = typeof (date as { toDate: () => Date }).toDate === 'function'
    ? (date as { toDate: () => Date }).toDate()
    : new Date(date as unknown as string);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-IN');
}

/**
 * Urgency level to color mapping
 */
export function urgencyColor(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return '#DC2626';
    case 'HIGH':
      return '#EA580C';
    case 'MEDIUM':
      return '#D97706';
    case 'LOW':
      return '#65A30D';
    default:
      return '#6B7280';
  }
}

/**
 * Urgency level to background color
 */
export function urgencyBgColor(level: string): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-50 border-red-200 text-red-800';
    case 'HIGH':
      return 'bg-orange-50 border-orange-200 text-orange-800';
    case 'MEDIUM':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'LOW':
      return 'bg-green-50 border-green-200 text-green-800';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-800';
  }
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Role display labels
 */
export function roleLabel(role: string): string {
  switch (role) {
    case 'COORDINATOR':
      return 'Coordinator';
    case 'FIELD_VOLUNTEER':
      return 'Field Volunteer';
    case 'DOCTOR':
      return 'Doctor';
    case 'PHARMACIST':
      return 'Pharmacist';
    case 'SUPPORT':
      return 'Support Staff';
    default:
      return role;
  }
}
