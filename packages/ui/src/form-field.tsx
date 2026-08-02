import type { JSX } from "react";
import { Label } from "./label";
import { cn } from "./utils";

export interface FormFieldProps {
  /** Accessible label text */
  label: string;
  /** Must match the `id` of the inner form control */
  htmlFor: string;
  /** Appends a red asterisk to the label */
  required?: boolean;
  /** When truthy, renders a red error message below the control */
  error?: string | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Composes Label + form control + inline error message.
 *
 * Eliminates the repeated `<div className="flex flex-col gap-1.5">` +
 * `<Label>` + `<Input>` + `{errors.x && <p>}` pattern across every form.
 *
 * Usage:
 *   <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
 *     <Input id="email" type="email" hasError={!!errors.email} {...register("email")} />
 *   </FormField>
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  children,
  className,
}: FormFieldProps): JSX.Element {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>

      {children}

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
