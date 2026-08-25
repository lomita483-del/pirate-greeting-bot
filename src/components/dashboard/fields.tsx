import { useRef, useState, type ReactNode } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export type Option = { id: string; name: string };

export function ImageUrlField({
  guildId,
  value,
  onChange,
  placeholder = "https://example.com/image.png",
}: {
  guildId: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = useServerFn(uploadDashboardImage);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("guildId", guildId);
      form.set("file", file);
      const result = await upload({ data: form });
      onChange(result.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that image.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        type="url"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      />
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(event) => void uploadFile(event.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        title="Upload image"
        aria-label="Upload image"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
      </Button>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

const NONE = "__none__";

export function PickerSelect({
  value,
  options,
  onChange,
  placeholder,
  emptyLabel = "Not set",
}: {
  value: string | null;
  options: Option[];
  onChange: (value: string | null) => void;
  placeholder: string;
  emptyLabel?: string;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
      <SelectTrigger className="bg-secondary/40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MultiPicker({
  values,
  options,
  onChange,
  emptyLabel,
}: {
  values: string[];
  options: Option[];
  onChange: (values: string[]) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = values.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() =>
              onChange(active ? values.filter((v) => v !== option.id) : [...values, option.id])
            }
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {badge ? (
        <Badge variant="outline" className="border-gold/40 text-gold">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}
