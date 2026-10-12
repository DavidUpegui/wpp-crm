"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

const SECTION_LINKS: readonly NavLink[] = [
  { href: "/inbox", label: "Bandeja" },
  { href: "/contacts", label: "Contactos" },
  { href: "/templates", label: "Plantillas" },
];

const USER_MANAGEMENT_LINK: NavLink = { href: "/users", label: "Usuarios" };

type NavLinksProps = {
  /**
   * Computed on the server from the user's role (`isAdmin`). Hiding the link
   * is only cosmetic: the users page and API check the role themselves (FR-007).
   */
  canManageUsers: boolean;
};

/**
 * Main navigation of the app shell (FR-019). "Usuarios" is shown to admins
 * only (AC-3.2). A client component only to highlight the current section.
 */
export function NavLinks({ canManageUsers }: NavLinksProps): React.JSX.Element {
  const pathname = usePathname();
  const links = canManageUsers ? [...SECTION_LINKS, USER_MANAGEMENT_LINK] : SECTION_LINKS;

  return (
    <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-1">
      {links.map((link) => {
        const isActive = isCurrentSection(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** True for the section itself and any page inside it (e.g. `/inbox/123`). */
function isCurrentSection(pathname: string, sectionPath: string): boolean {
  return pathname === sectionPath || pathname.startsWith(`${sectionPath}/`);
}
