import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fonte de verdade: lê data-theme do DOM, com fallback para classList e prefers-color-scheme
function getThemeFromDOM(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  if (document.documentElement.classList.contains("dark")) return "dark";
  try {
    const saved = sessionStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // sessionStorage pode estar indisponível; usa preferência do sistema.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
  try {
    sessionStorage.setItem("theme", theme);
  } catch {
    // O tema continua aplicado no DOM mesmo sem persistência.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(getThemeFromDOM);

  // Sincroniza com o DOM ao montar — garante que o ícone reflita o tema real,
  // mesmo que outro componente (DarkModeToggle no AppShell) tenha alterado antes.
  useEffect(() => {
    const current = getThemeFromDOM();
    setTheme(current);
    applyTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
