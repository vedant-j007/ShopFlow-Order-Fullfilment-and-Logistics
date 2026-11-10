import { BookOpen, CookingPot, Dumbbell, Laptop, Package, Shirt } from 'lucide-react';

const ART = {
  Electronics: { Icon: Laptop, bg: 'from-sky-50 to-indigo-100', fg: 'text-indigo-500' },
  'Home & Kitchen': { Icon: CookingPot, bg: 'from-amber-50 to-orange-100', fg: 'text-orange-500' },
  Fashion: { Icon: Shirt, bg: 'from-pink-50 to-rose-100', fg: 'text-rose-500' },
  Books: { Icon: BookOpen, bg: 'from-emerald-50 to-teal-100', fg: 'text-teal-600' },
  'Sports & Fitness': { Icon: Dumbbell, bg: 'from-lime-50 to-green-100', fg: 'text-green-600' },
};
const FALLBACK = { Icon: Package, bg: 'from-slate-50 to-slate-200', fg: 'text-slate-500' };

export default function CategoryArt({ category, className = 'size-12 rounded-xl', iconClassName = 'size-6' }) {
  const { Icon, bg, fg } = ART[category] ?? FALLBACK;
  return (
    <div className={`grid shrink-0 place-items-center bg-linear-to-br ${bg} ${className}`}>
      <Icon className={`${fg} ${iconClassName}`} strokeWidth={1.5} />
    </div>
  );
}
