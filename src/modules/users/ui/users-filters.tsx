"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USER_ROLES, type UserListFilters, type UserListStatusFilter } from "@/modules/users/domain/user";

import { USER_STATUS_LABELS } from "./messages";
import { getRoleLabel } from "./role-labels";

/** Select value meaning "do not filter"; never sent in the URL. */
const ALL_VALUE = "all";
const ALL_LABEL = "Todos";

/** URL query parameter names; `src/app/(app)/users/page.tsx` reads the same names. */
const USERS_QUERY_PARAMS = {
  search: "search",
  role: "role",
  status: "status",
} as const;

/** Filter labels follow the 13px meta size of plan §7b. */
const FILTER_LABEL_CLASS = "text-meta";

const STATUS_FILTER_VALUES: UserListStatusFilter[] = ["active", "inactive", "must_change_password"];

const ROLE_ITEMS: Record<string, string> = {
  [ALL_VALUE]: ALL_LABEL,
  ...Object.fromEntries(USER_ROLES.map((role) => [role, getRoleLabel(role)])),
};

const STATUS_ITEMS: Record<string, string> = {
  [ALL_VALUE]: ALL_LABEL,
  ...USER_STATUS_LABELS,
};

type UsersFiltersProps = {
  /** The filters the server applied (already validated), shown as the current values. */
  filters: UserListFilters;
};

/**
 * Search box plus role and status filters of "Usuarios" (AC-6.2, AC-6.3).
 *
 * Every change rewrites the URL query (keeping the other parameters), so the
 * filters combine, the page can be bookmarked/reloaded, and the server
 * renders the filtered list again.
 *
 * The search runs on Enter (or the "Buscar" button) instead of while typing:
 * it is the simplest robust option — no timers, no request per keystroke and
 * no race between an old and a new search.
 */
export function UsersFilters({ filters }: UsersFiltersProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const appliedSearch = filters.search ?? "";
  const [searchText, setSearchText] = useState(appliedSearch);
  const [previousAppliedSearch, setPreviousAppliedSearch] = useState(appliedSearch);
  // When the URL changes from outside (e.g. "Limpiar filtros", back button),
  // show the search the server actually applied.
  if (appliedSearch !== previousAppliedSearch) {
    setPreviousAppliedSearch(appliedSearch);
    setSearchText(appliedSearch);
  }

  function updateQueryParam(name: string, value: string): void {
    const nextParams = new URLSearchParams(searchParams.toString());
    const trimmedValue = value.trim();
    if (trimmedValue === "" || trimmedValue === ALL_VALUE) {
      nextParams.delete(name);
    } else {
      nextParams.set(name, trimmedValue);
    }
    const query = nextParams.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateQueryParam(USERS_QUERY_PARAMS.search, searchText);
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4" aria-busy={isPending}>
      <form role="search" onSubmit={handleSearchSubmit} className="flex flex-col gap-2 md:w-80">
        <Label htmlFor="users-search" className={FILTER_LABEL_CLASS}>
          Buscar por nombre o correo
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="users-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Nombre o correo"
              className="bg-card pl-8"
            />
          </div>
          <Button type="submit" variant="outline" disabled={isPending}>
            Buscar
          </Button>
        </div>
      </form>

      <FilterSelect
        id="users-role-filter"
        label="Rol"
        items={ROLE_ITEMS}
        values={USER_ROLES}
        value={filters.role ?? ALL_VALUE}
        onChange={(value) => updateQueryParam(USERS_QUERY_PARAMS.role, value)}
      />

      <FilterSelect
        id="users-status-filter"
        label="Estado"
        items={STATUS_ITEMS}
        values={STATUS_FILTER_VALUES}
        value={filters.status ?? ALL_VALUE}
        onChange={(value) => updateQueryParam(USERS_QUERY_PARAMS.status, value)}
      />
    </div>
  );
}

type FilterSelectProps = {
  id: string;
  label: string;
  /** Label of every option, keyed by value ("all" included). */
  items: Record<string, string>;
  /** The real filter values, in display order ("Todos" is always first). */
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

/** One labelled "Todos / …" dropdown. */
function FilterSelect({ id, label, items, values, value, onChange }: FilterSelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className={FILTER_LABEL_CLASS}>
        {label}
      </Label>
      <Select items={items} value={value} onValueChange={(nextValue) => onChange(nextValue ?? ALL_VALUE)}>
        <SelectTrigger id={id} className="w-full bg-card md:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{ALL_LABEL}</SelectItem>
          {values.map((optionValue) => (
            <SelectItem key={optionValue} value={optionValue}>
              {items[optionValue]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
