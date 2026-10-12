import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";

import type { UserRole } from "@/modules/users/domain/user";
import { getRoleLabel } from "@/modules/users/ui/role-labels";

const ACCOUNT_PATH = "/account";

// The shadcn button variants assume a light surface, so the sidebar actions
// use their own classes (same hover/focus language as the nav links).
const ACTION_CLASSES =
  "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-body font-medium whitespace-nowrap text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar max-md:h-8 max-md:gap-2 max-md:px-2 max-md:text-sm";

/** The only user data the shell needs; never pass the whole user or session. */
export type AppShellUser = {
  name: string;
  role: UserRole;
};

type UserMenuProps = {
  user: AppShellUser;
  /** The logout Server Action, passed in by the layout (keeps components independent of `src/app/`). */
  logOutAction: () => Promise<void>;
};

/**
 * The logged-in user's name and role, with "Mi cuenta" and "Cerrar sesión"
 * (FR-019, AC-2.1). Logout is a plain form, so it works even before the
 * page's JavaScript has loaded. At the bottom of the sidebar on desktop; a
 * compact row in the top bar on small screens (the name and role are hidden
 * on very narrow phones to leave room for the two actions).
 */
export function UserMenu({ user, logOutAction }: UserMenuProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-1 md:border-t md:border-sidebar-border md:pt-4">
      <div className="flex min-w-0 flex-col leading-tight max-sm:hidden md:mb-2 md:px-3">
        <span className="truncate text-sm font-medium max-md:max-w-36">{user.name}</span>
        <span className="text-meta text-sidebar-foreground/70">{getRoleLabel(user.role)}</span>
      </div>
      <Link href={ACCOUNT_PATH} className={ACTION_CLASSES}>
        <UserRound aria-hidden="true" className="size-4" />
        Mi cuenta
      </Link>
      <form action={logOutAction}>
        <button type="submit" className={ACTION_CLASSES}>
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
