export function required(value: string, label: string) {
  return value.trim() ? "" : `${label} is required.`;
}

export function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Enter a valid email address.";
}

export function positiveNumber(value: number, label: string) {
  return Number.isFinite(value) && value > 0 ? "" : `${label} must be greater than zero.`;
}

export function nonNegativeNumber(value: number, label: string) {
  return Number.isInteger(value) && value >= 0 ? "" : `${label} must be zero or greater.`;
}
