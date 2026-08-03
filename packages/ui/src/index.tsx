import type { ButtonHTMLAttributes, FC, HTMLAttributes, ReactNode } from 'react';

export const workspaceName = '@eventory/ui';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: FC<ButtonProps> = ({ className, variant = 'primary', ...props }) => (
  <button className={cx('ui-button', `ui-button--${variant}`, className)} {...props} />
);

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export const Card: FC<CardProps> = ({ className, children, ...props }) => (
  <section className={cx('ui-card', className)} {...props}>
    {children}
  </section>
);

export interface StatusBadgeProps {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export const StatusBadge: FC<StatusBadgeProps> = ({ label, tone = 'neutral' }) => (
  <span className={cx('ui-badge', `ui-badge--${tone}`)}>{label}</span>
);

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

export const Field: FC<FieldProps> = ({ label, htmlFor, hint, children, className, ...props }) => (
  <div className={cx('ui-field', className)} {...props}>
    <label className="ui-field__label" htmlFor={htmlFor}>
      {label}
    </label>
    {children}
    {hint ? <div className="ui-field__hint">{hint}</div> : null}
  </div>
);

export const Container: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cx('ui-container', className)}>{children}</div>;
