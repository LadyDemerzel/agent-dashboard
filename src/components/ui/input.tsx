import * as React from "react";
import { cn } from "@/lib/utils";

function inputValueToString(value: React.InputHTMLAttributes<HTMLInputElement>["value"]) {
  if (value === undefined || value === null) return "";
  return Array.isArray(value) ? value.join(",") : String(value);
}

function isIncompleteNumberDraft(value: string) {
  const trimmed = value.trim();
  return (
    trimmed === ""
    || trimmed === "-"
    || trimmed === "+"
    || trimmed === "."
    || trimmed === "-."
    || trimmed === "+."
  );
}

function numberInputMode(
  inputMode: React.InputHTMLAttributes<HTMLInputElement>["inputMode"],
  min: React.InputHTMLAttributes<HTMLInputElement>["min"],
  step: React.InputHTMLAttributes<HTMLInputElement>["step"],
) {
  if (inputMode) return inputMode;
  const minText = min == null ? "" : String(min);
  const stepText = step == null ? "" : String(step);
  return minText.startsWith("-") || stepText.includes(".") ? "decimal" : "numeric";
}

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({
  className,
  type,
  value,
  onChange,
  onFocus,
  onBlur,
  inputMode,
  min,
  step,
  ...props
}, ref) => {
  const isNumberInput = type === "number";
  const isControlledNumberInput = isNumberInput && value !== undefined;
  const externalValue = inputValueToString(value);
  const [isFocused, setIsFocused] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState(externalValue);

  React.useEffect(() => {
    if (!isControlledNumberInput || isFocused) return;
    setDraftValue(externalValue);
  }, [externalValue, isControlledNumberInput, isFocused]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isNumberInput) {
      onChange?.(event);
      return;
    }

    const nextValue = event.target.value;
    setDraftValue(nextValue);

    if (isIncompleteNumberDraft(nextValue)) {
      if (typeof value === "string") onChange?.(event);
      return;
    }
    if (!Number.isFinite(Number(nextValue))) return;

    onChange?.(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (isNumberInput) {
      setIsFocused(true);
      if (isControlledNumberInput) setDraftValue(externalValue);
    }
    onFocus?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (isNumberInput) {
      const nextValue = event.target.value;
      const shouldKeepDraft =
        isControlledNumberInput
        && !Number.isNaN(Number(nextValue))
        && (!isIncompleteNumberDraft(nextValue) || typeof value === "string");
      setIsFocused(false);
      if (isControlledNumberInput) {
        setDraftValue(shouldKeepDraft ? nextValue : externalValue);
      }
    }
    onBlur?.(event);
  };

  return (
    <input
      type={isNumberInput ? "text" : type}
      inputMode={isNumberInput ? numberInputMode(inputMode, min, step) : inputMode}
      min={min}
      step={step}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      value={isControlledNumberInput ? draftValue : value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
