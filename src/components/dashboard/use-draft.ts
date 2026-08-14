import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { updateGuildSection } from "@/lib/ahoy.functions";

type Section = "general" | "welcome" | "logging" | "automod" | "roles";

export function useDraft<T extends Record<string, unknown>>(
  guildId: string,
  section: Section,
  initial: T,
  onSaved: () => void,
) {
  const [draft, setDraft] = useState<T>(initial);
  const initialKey = useMemo(() => JSON.stringify(initial), [initial]);

  useEffect(() => {
    setDraft(JSON.parse(initialKey) as T);
  }, [initialKey]);

  const save = useServerFn(updateGuildSection);
  const mutation = useMutation({
    mutationFn: () => save({ data: { guildId, section, values: draft } }),
    onSuccess: () => {
      toast.success("Settings saved");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message || "Could not save settings"),
  });

  return {
    draft,
    set: <K extends keyof T>(key: K, value: T[K]) =>
      setDraft((current) => ({ ...current, [key]: value })),
    dirty: JSON.stringify(draft) !== initialKey,
    saving: mutation.isPending,
    save: () => mutation.mutate(),
    reset: () => setDraft(JSON.parse(initialKey) as T),
  };
}
