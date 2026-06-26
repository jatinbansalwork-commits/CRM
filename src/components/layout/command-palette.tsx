"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/constants";
import { useContactSearch } from "@/hooks/use-contact-search";
import { shouldSearchQuery } from "@/lib/search/fts-query";
import { Loader2 } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { data: contacts = [], isFetching, isLoading } = useContactSearch(query);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const showContactSearch = shouldSearchQuery(query);
  const searching = showContactSearch && (isFetching || isLoading);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search contacts or navigate..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {searching && (
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Searching...
          </p>
        )}

        {!searching && showContactSearch && contacts.length === 0 && (
          <CommandEmpty>No contacts found.</CommandEmpty>
        )}

        {contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {contacts.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.name ?? ""} ${c.email} ${c.company?.name ?? ""}`}
                onSelect={() => navigate(`/contacts?selected=${c.id}`)}
              >
                <span className="font-medium">{c.name ?? c.email}</span>
                {c.company?.name && (
                  <span className="ml-2 text-muted-foreground">{c.company.name}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {navMatches.length > 0 && (
          <>
            {contacts.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Navigate">
              {navMatches.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.label}
                  onSelect={() => navigate(item.href)}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
