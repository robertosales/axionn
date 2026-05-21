import React, { useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SIZE_OPTIONS } from "@/lib/constants";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const SizeSelector = React.memo(function SizeSelector({ value, onChange, className, placeholder }: Props) {
  const handleChange = useCallback((v: string) => onChange(v), [onChange]);

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? "Tamanho"} />
      </SelectTrigger>
      <SelectContent>
        {SIZE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className={`font-semibold ${opt.color ?? ""}`}>{opt.label}</span>
            {opt.description && (
              <span className="ml-1.5 text-muted-foreground text-xs">{opt.description}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
