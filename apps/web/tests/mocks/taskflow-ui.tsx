/**
 * Mock for @taskflow/ui — replaces every primitive with a minimal
 * HTML equivalent so pages render in jsdom without Tailwind/CSS.
 *
 * Activate per test file:
 *   vi.mock("@taskflow/ui", () => import("../mocks/taskflow-ui"));
 */

import type { JSX } from "react";

// -- Button --

interface MockButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  fullWidth?: boolean;
  variant?: string;
  size?: string;
}

export function Button({
  children,
  loading,
  fullWidth: _fullWidth,
  variant: _variant,
  size: _size,
  ...rest
}: MockButtonProps): JSX.Element {
  return (
    <button disabled={loading} {...rest}>
      {children}
    </button>
  );
}

// -- Input --

interface MockInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError: _hasError, ...rest }: MockInputProps): JSX.Element {
  return <input {...rest} />;
}

// -- Label --

interface MockLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required: _required, ...rest }: MockLabelProps): JSX.Element {
  return <label {...rest}>{children}</label>;
}

// -- Card family --

interface ChildrenProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: ChildrenProps): JSX.Element {
  return <div className={className}>{children}</div>;
}

export function CardHeader({ children, className }: ChildrenProps): JSX.Element {
  return <div className={className}>{children}</div>;
}

export function CardTitle({ children, className }: ChildrenProps): JSX.Element {
  return <h2 className={className}>{children}</h2>;
}

export function CardContent({ children, className }: ChildrenProps): JSX.Element {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className }: ChildrenProps): JSX.Element {
  return <div className={className}>{children}</div>;
}

// -- Badge --

interface MockBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: string;
}

export function Badge({ children, variant: _variant, ...rest }: MockBadgeProps): JSX.Element {
  return <span {...rest}>{children}</span>;
}

// -- Select --

interface MockSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function Select({ hasError: _hasError, children, ...rest }: MockSelectProps): JSX.Element {
  return <select {...rest}>{children}</select>;
}

// -- Spinner --

interface MockSpinnerProps {
  size?: string;
  label?: string;
  className?: string;
}

export function Spinner({ label = "Loading", ...rest }: MockSpinnerProps): JSX.Element {
  return <span role="status" aria-label={label} {...rest} />;
}

// -- Dialog --

interface MockDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  title,
  description,
  children,
  footer,
}: MockDialogProps): JSX.Element | null {
  if (!open) return null;
  return (
    <dialog open>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
      {footer && <div className="mock-dialog-footer">{footer}</div>}
    </dialog>
  );
}

// -- Toast --

interface MockToastProps {
  message: string;
  variant?: string;
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: MockToastProps): JSX.Element {
  return (
    <div role="alert">
      {message}
      <button onClick={onDismiss} aria-label="Dismiss notification">
        x
      </button>
    </div>
  );
}

interface MockToastContainerProps {
  toasts: { id: string; message: string; variant?: string; duration?: number }[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: MockToastContainerProps): JSX.Element {
  return (
    <div>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          onDismiss={() => {
            onDismiss(t.id);
          }}
        />
      ))}
    </div>
  );
}

// -- cn utility (pass-through in tests) --

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
