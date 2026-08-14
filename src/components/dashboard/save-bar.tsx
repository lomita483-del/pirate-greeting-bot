import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 backdrop-blur">
      <span className="mr-auto text-xs text-muted-foreground">
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty || saving}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save changes
      </Button>
    </div>
  );
}
