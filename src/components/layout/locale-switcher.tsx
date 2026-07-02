"use client";

import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCALES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export function LocaleSwitcher() {
  const locale = useLocale();

  const switchLocale = useCallback((newLocale: string) => {
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    window.location.reload();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Languages className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => switchLocale(l.value)}
            disabled={l.value === locale}
            className="text-sm"
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
