export function cn(...values) {
  return values
    .flat(Infinity)
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ')
}
