import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import type { UserRole } from "@/modules/users/domain/user";
import { getRoleLabel } from "@/modules/users/ui/role-labels";

const ACCOUNT_PATH = "/account";

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
 * page's JavaScript has loaded.
 */
export function UserMenu({ user, logOutAction }: UserMenuProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-col text-right leading-tight">
        <span className="text-sm font-medium">{user.name}</span>
        <span className="text-xs text-muted-foreground">{getRoleLabel(user.role)}</span>
      </div>
      <Link href={ACCOUNT_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Mi cuenta
      </Link>
      <form action={logOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
