"use client";

import { Contact, FileText, MessageCircle, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const SECTION_LINKS: readonly NavLink[] = [
  { href: "/inbox", label: "Bandeja", icon: MessageCircle },
  { href: "/contacts", label: "Contactos", icon: Contact },
  { href: "/templates", label: "Plantillas", icon: FileText },
];

const USER_MANAGEMENT_LINK: NavLink = { href: "/users", label: "Usuarios", icon: UserCog };

const LINK_BASE_CLASSES =
  "flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-body font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
const LINK_IDLE_CLASSES =
  "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const LINK_ACTIVE_CLASSES = "bg-sidebar-primary text-sidebar-primary-foreground";

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
 * Vertical list in the sidebar; a horizontally scrollable row below 768px.
 */
export function NavLinks({ canManageUsers }: NavLinksProps): React.JSX.Element {
  const pathname = usePathname();
  const links = canManageUsers ? [...SECTION_LINKS, USER_MANAGEMENT_LINK] : SECTION_LINKS;

  return (
    <nav aria-label="Navegación principal">
      {/* Padding keeps the focus ring visible inside the scrolling row. */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto p-1 md:mx-0 md:flex-col md:overflow-visible md:p-0">
        {links.map((link) => {
          const isActive = isCurrentSection(pathname, link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(LINK_BASE_CLASSES, isActive ? LINK_ACTIVE_CLASSES : LINK_IDLE_CLASSES)}
              >
                <Icon aria-hidden="true" className="size-4" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** True for the section itself and any page inside it (e.g. `/inbox/123`). */
function isCurrentSection(pathname: string, sectionPath: string): boolean {
  return pathname === sectionPath || pathname.startsWith(`${sectionPath}/`);
}
