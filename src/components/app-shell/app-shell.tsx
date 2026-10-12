import { Toaster } from "@/components/ui/sonner";

import { NavLinks } from "./nav-links";
import { UserMenu, type AppShellUser } from "./user-menu";

const MAIN_CONTENT_ID = "main";

/** Hidden until focused with the keyboard; then a Paper pill over the top-left corner. */
const SKIP_LINK_CLASSES =
  "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-body focus:font-medium focus:text-foreground focus:shadow-md focus:outline-none focus:ring-3 focus:ring-ring";

type AppShellProps = {
  user: AppShellUser;
  /** Whether to show the "Usuarios" link; computed on the server from the role. */
  canManageUsers: boolean;
  /** The logout Server Action, passed in by the layout. */
  logOutAction: () => Promise<void>;
  children: React.ReactNode;
};

/**
 * Frame of every page after login (FR-019, plan §7b): a 240px pine-ink
 * sidebar with the app name, navigation and user menu, and the current page
 * on the Mineral workspace. Below 768px the sidebar becomes a top bar (the
 * nav scrolls horizontally). It also mounts the toast container once, for
 * the confirmation messages of later screens.
 *
 * The sidebar is a `<header>` (site banner + navigation, not side content);
 * a skip link before it lets keyboard users jump straight to `#main`. On
 * short desktop viewports the sidebar scrolls so the user menu stays
 * reachable.
 *
 * The sidebar children are in reading order for desktop (name → nav → user);
 * on small screens `order-*` moves the user menu next to the app name.
 */
export function AppShell({
  user,
  canManageUsers,
  logOutAction,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <a href={`#${MAIN_CONTENT_ID}`} className={SKIP_LINK_CLASSES}>
        Saltar al contenido
      </a>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-sidebar px-4 pt-3 pb-2 text-sidebar-foreground md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:overflow-y-auto md:px-3 md:py-5">
        <span className="order-1 text-section font-semibold tracking-tight md:px-3">WPP CRM</span>
        <div className="order-3 w-full md:order-2">
          <NavLinks canManageUsers={canManageUsers} />
        </div>
        <div className="order-2 ml-auto md:order-3 md:mt-auto md:ml-0">
          <UserMenu user={user} logOutAction={logOutAction} />
        </div>
      </header>
      {/* tabIndex -1 lets the skip link move focus here, not only scroll. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none md:pl-60">
        <div className="flex w-full max-w-[1100px] flex-1 flex-col px-4 py-6 sm:px-6 md:px-10 md:py-10">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
