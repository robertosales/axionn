import React, { useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SIZE_REFERENCES } from "@/lib/sizeReference";

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
        {SIZE_REFERENCES.map((opt) => (
          <SelectItem key={opt.key} value={opt.key}>
            <span className="font-semibold">{opt.label}</span>
            <span className="ml-1.5 text-muted-foreground text-xs">{opt.pointsLabel} · {opt.hours}h</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
