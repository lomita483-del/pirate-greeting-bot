import { useEffect, useState } from "react";
import { Image, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminTheme = "current" | "classic";
const KEY = "ahoy-admin-theme";

export function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>("current");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    const next: AdminTheme = saved === "classic" ? "classic" : "current";
    setTheme(next);
    document.documentElement.dataset.adminTheme = next;
  }, []);

  const toggle = () => {
    const next: AdminTheme = theme === "current" ? "classic" : "current";
    setTheme(next);
    window.localStorage.setItem(KEY, next);
    document.documentElement.dataset.adminTheme = next;
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      aria-label={`Switch to ${theme === "current" ? "previous" : "current"} admin theme`}
      title={`Theme: ${theme === "current" ? "Current" : "Previous"} — click to switch`}
      className="gap-2 rounded-xl border-white/10 bg-white/[.04]"
    >
      {theme === "current" ? <Image className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{theme === "current" ? "Current Theme" : "Previous Theme"}</span>
    </Button>
  );
}
