import { cn } from '../../lib/cn';

interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, color = '#ff4d00', size = 'md', className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const sizes = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' };

  return (
    <span
      aria-label={name}
      role="img"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', sizes[size], className)}
      style={{ backgroundColor: color }}
    >
      {initials || 'W'}
    </span>
  );
}
