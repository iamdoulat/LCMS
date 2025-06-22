"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so we can safely set the mounted state
  React.useEffect(() => {
    setMounted(true);
  }, []);


  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  
  // Until the component is mounted, we can render a placeholder or nothing to avoid mismatch
  if (!mounted) {
    return <Button variant="ghost" size="icon" className="h-9 w-9" disabled={true} aria-label="Toggle theme"></Button>;
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label="Toggle theme">
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-muted-foreground transition-all" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
