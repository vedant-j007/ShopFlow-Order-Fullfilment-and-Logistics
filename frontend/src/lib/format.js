const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const compactInr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat('en-IN');

export const money = (n) => inr.format(n ?? 0);
export const compactMoney = (n) => compactInr.format(n ?? 0);
export const number = (n) => plain.format(n ?? 0);

export const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const UNITS = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(d) {
  const seconds = (Date.now() - new Date(d).getTime()) / 1000;
  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      const value = Math.floor(seconds / size);
      return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

export const humanize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ') : '');
