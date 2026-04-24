// Format a macro range as "min–max unit"
export function formatRange(min, max, unit = '') {
  if (min == null || max == null) return 'N/A';
  return `${Math.round(min)}–${Math.round(max)}${unit ? ' ' + unit : ''}`;
}

// Format avg value
export function formatAvg(avg, unit = '') {
  if (avg == null) return 'N/A';
  return `${Math.round(avg)}${unit ? ' ' + unit : ''}`;
}

// Format calorie range
export function formatCalories(nutrition) {
  if (!nutrition?.calories) return 'N/A';
  return formatRange(nutrition.calories.min, nutrition.calories.max, 'kcal');
}

// Format macro range (protein, carbs, fat)
export function formatMacro(nutrition, macro) {
  if (!nutrition?.[macro]) return 'N/A';
  return formatRange(nutrition[macro].min, nutrition[macro].max, 'g');
}

// Format date
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
