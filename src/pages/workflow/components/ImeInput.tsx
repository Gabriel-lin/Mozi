import React, { useRef, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";

interface ImeInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * Input wrapper that keeps a local mirror so React never resets the DOM
 * during IME composition. External onValueChange is deferred until
 * compositionEnd for CJK input methods.
 *
 * The component is expected to be keyed (remounted) when the editing
 * target changes, so no external→local sync is needed.
 */
export function ImeInput({ value, onValueChange, ...props }: ImeInputProps) {
  const composingRef = useRef(false);
  const [local, setLocal] = useState(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setLocal(v);
      if (!composingRef.current) onValueChange(v);
    },
    [onValueChange],
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const v = e.currentTarget.value;
      setLocal(v);
      onValueChange(v);
    },
    [onValueChange],
  );

  return (
    <Input
      value={local}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      {...props}
    />
  );
}
