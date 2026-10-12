import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { User, UserListStatusFilter } from "@/modules/users/domain/user";

import {
  CLEAR_FILTERS_LABEL,
  getUserDisplayStatus,
  NEVER_LOGGED_IN_LABEL,
  NO_USERS_FOUND_MESSAGE,
  USER_STATUS_LABELS,
} from "./messages";
import { EditUserDialog } from "./edit-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { getRoleLabel } from "./role-labels";
import { ToggleUserStatusDialog } from "./toggle-user-status-dialog";
import type { UserManagementActions } from "./user-dialogs-state";

const USERS_PATH = "/users";

/**
 * Spanish date-time, e.g. "12 oct 2026, 14:05". This is a Server Component,
 * so the date is formatted in the SERVER's timezone (the same for every
 * viewer); per-viewer timezones are out of scope for this feature.
 */
const LAST_LOGIN_FORMATTER = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

/** Badge look per status: active users stand out, inactive ones fade, pending changes warn. */
const STATUS_BADGE_VARIANTS: Record<UserListStatusFilter, "default" | "secondary" | "destructive"> = {
  active: "default",
  inactive: "secondary",
  must_change_password: "destructive",
};

type UsersTableProps = {
  /** The users to show, already filtered and ordered by the server. */
  users: User[];
  /** The logged-in admin's id: their own row offers no self actions (BR-009). */
  currentUserId: string;
  /** The Server Actions the row dialogs submit to, passed in by the page. */
  actions: UserManagementActions;
};

/**
 * The "Usuarios" table (AC-6.1): name, email, role, status and last login
 * ("Nunca" when never), plus the row actions (US-8–US-10). With no rows it
 * shows the empty state with a link that clears search and filters (AC-6.4).
 */
export function UsersTable({ users, currentUserId, actions }: UsersTableProps): React.JSX.Element {
  if (users.length === 0) {
    return <EmptyUsersState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Correo</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Último acceso</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <UserRow key={user.id} user={user} isCurrentUser={user.id === currentUserId} actions={actions} />
        ))}
      </TableBody>
    </Table>
  );
}

type UserRowProps = {
  user: User;
  isCurrentUser: boolean;
  actions: UserManagementActions;
};

function UserRow({ user, isCurrentUser, actions }: UserRowProps): React.JSX.Element {
  const displayStatus = getUserDisplayStatus(user);

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{getRoleLabel(user.role)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE_VARIANTS[displayStatus]}>{USER_STATUS_LABELS[displayStatus]}</Badge>
      </TableCell>
      <TableCell>{formatLastLogin(user.lastLoginAt)}</TableCell>
      <TableCell>
        <UserRowActions user={user} isCurrentUser={isCurrentUser} actions={actions} />
      </TableCell>
    </TableRow>
  );
}

/**
 * "Editar", "Restablecer contraseña" and "Desactivar"/"Reactivar" of one row.
 * On the admin's own row only "Editar" is offered (renaming is allowed): an
 * admin cannot deactivate themselves or reset their own password here
 * (AC-9.3, AC-10.2 — they use "Mi cuenta"). The server rejects both anyway.
 */
function UserRowActions({ user, isCurrentUser, actions }: UserRowProps): React.JSX.Element {
  // Only the fields the dialogs need are sent to the browser.
  const dialogUser = { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
  const toggleStatusAction = user.status === "active" ? actions.deactivateUser : actions.reactivateUser;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <EditUserDialog user={dialogUser} isCurrentUser={isCurrentUser} action={actions.updateUser} />
      {!isCurrentUser && (
        <>
          <ResetPasswordDialog user={dialogUser} action={actions.resetUserPassword} />
          <ToggleUserStatusDialog user={dialogUser} action={toggleStatusAction} />
        </>
      )}
    </div>
  );
}

function EmptyUsersState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
      <p className="text-muted-foreground">{NO_USERS_FOUND_MESSAGE}</p>
      <Link href={USERS_PATH} className={buttonVariants({ variant: "outline" })}>
        {CLEAR_FILTERS_LABEL}
      </Link>
    </div>
  );
}

function formatLastLogin(lastLoginAt: Date | null): string {
  if (!lastLoginAt) {
    return NEVER_LOGGED_IN_LABEL;
  }
  return LAST_LOGIN_FORMATTER.format(lastLoginAt);
}
