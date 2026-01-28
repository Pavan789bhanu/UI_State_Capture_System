import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================
// METRIC CARD - For investor-ready dashboards
// ============================================
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  loading?: boolean;
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel = 'vs last period',
  icon: Icon,
  iconColor = 'rgb(var(--brand))',
  loading = false,
  className = ''
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  return (
    <div className={`metric-card group ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div 
              className="metric-icon"
              style={{ backgroundColor: `${iconColor}15`, color: iconColor }}
            >
              <Icon size={20} strokeWidth={2} />
            </div>
          )}
          <span className="text-sm font-medium text-secondary">{title}</span>
        </div>
        {change !== undefined && (
          <div className={`change-badge ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
            <TrendIcon size={12} />
            <span>{isPositive ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          {loading ? (
            <div className="h-9 w-24 bg-tertiary rounded-lg animate-pulse" />
          ) : (
            <span className="text-3xl font-bold text-primary tracking-tight">{value}</span>
          )}
          {change !== undefined && (
            <p className="text-xs text-secondary mt-1">{changeLabel}</p>
          )}
        </div>
      </div>
      
      {/* Hover gradient effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
        style={{ 
          background: `linear-gradient(135deg, ${iconColor}05 0%, transparent 60%)` 
        }} 
      />
    </div>
  );
}

// ============================================
// STATUS BADGE - For execution states
// ============================================
interface StatusBadgeProps {
  status: 'success' | 'running' | 'failed' | 'pending' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  children?: ReactNode;
}

export function StatusBadge({ status, size = 'md', pulse = false, children }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-sm gap-2'
  };

  return (
    <span className={`status-badge status-${status} ${sizeClasses[size]}`}>
      <span className={`status-dot ${pulse ? 'animate-pulse' : ''}`} />
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ============================================
// BUTTON - Primary, Secondary, Ghost variants
// ============================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}, ref) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2'
  };

  return (
    <button
      ref={ref}
      className={`btn btn-${variant} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon && iconPosition === 'left' ? (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      )}
    </button>
  );
});

Button.displayName = 'Button';

// ============================================
// CARD - Base card component
// ============================================
interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', hover = false, padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// SECTION HEADER - For page sections
// ============================================
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, icon: Icon, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="section-icon">
            <Icon size={20} />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ============================================
// EMPTY STATE - Professional empty states
// ============================================
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>
      <p className="text-sm text-secondary mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

// ============================================
// SKELETON LOADER - For loading states
// ============================================
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className = '', 
  variant = 'rectangular',
  width,
  height 
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl'
  };

  return (
    <div 
      className={`skeleton ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

// ============================================
// AVATAR - User avatar with status
// ============================================
interface AvatarProps {
  name: string;
  image?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
}

export function Avatar({ name, image, size = 'md', status }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`avatar ${sizeClasses[size]}`}>
      {image ? (
        <img src={image} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
      {status && <span className={`avatar-status avatar-status-${status}`} />}
    </div>
  );
}

// ============================================
// PROGRESS BAR - For completion tracking
// ============================================
interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showLabel?: boolean;
}

export function Progress({ 
  value, 
  max = 100, 
  size = 'md', 
  color = 'rgb(var(--brand))',
  showLabel = false 
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="progress-wrapper">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-secondary">Progress</span>
          <span className="text-xs font-medium text-primary">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`progress-track ${sizeClasses[size]}`}>
        <div 
          className="progress-bar"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ============================================
// DIVIDER - Section divider
// ============================================
interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (label) {
    return (
      <div className="divider-with-label">
        <div className="divider-line" />
        <span className="divider-label">{label}</span>
        <div className="divider-line" />
      </div>
    );
  }
  return <div className="divider" />;
}
