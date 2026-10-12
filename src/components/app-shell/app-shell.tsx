import { Toaster } from "@/components/ui/sonner";

import { NavLinks } from "./nav-links";
import { UserMenu, type AppShellUser } from "./user-menu";

type AppShellProps = {
  user: AppShellUser;
  /** Whether to show the "Usuarios" link; computed on the server from the role. */
  canManageUsers: boolean;
  /** The logout Server Action, passed in by the layout. */
  logOutAction: () => Promise<void>;
  children: React.ReactNode;
};

/**
 * Frame of every page after login (FR-019): app name, navigation and the
 * user menu on top, the current page below. It also mounts the toast
 * container once, for the confirmation messages of later screens.
 */
export function AppShell({
  user,
  canManageUsers,
  logOutAction,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-lg font-semibold">WPP CRM</span>
          <NavLinks canManageUsers={canManageUsers} />
        </div>
        <UserMenu user={user} logOutAction={logOutAction} />
      </header>
      <main className="flex flex-1 flex-col px-4 py-6">{children}</main>
      <Toaster />
    </div>
  );
}
