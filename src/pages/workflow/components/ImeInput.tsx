import React, { useCallback, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface ImeInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Input wrapper that tolerates IME composition without losing the parent
 * value as the source of truth.
 *
 * - While not composing: the DOM value comes straight from `value`, so any
 *   external change (e.g. the same field being edited elsewhere like the
 *   inline node label) immediately reflects here.
 * - While composing (CJK IME): we buffer locally so React doesn't reset the
 *   DOM mid-composition. `onValueChange` fires on compositionEnd instead of
 *   on every intermediate change.
 */
export function ImeInput({ value, onValueChange, ...props }: ImeInputProps) {
  const composingRef = useRef(false);
  const [composingText, setComposingText] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (composingRef.current) {
        setComposingText(v);
      } else {
        onValueChange(v);
      }
    },
    [onValueChange],
  );

  const handleCompositionStart = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = true;
    setComposingText(e.currentTarget.value);
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const v = e.currentTarget.value;
      setComposingText(null);
      onValueChange(v);
    },
    [onValueChange],
  );

  const displayValue = composingText ?? value;

  return (
    <Input
      value={displayValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      {...props}
    />
  );
}
