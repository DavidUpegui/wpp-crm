import { SearchXIcon } from "lucide-react";
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

/** Badge tint per status (plan §7b): mint for active, amber for a pending change, slate for inactive. */
const STATUS_BADGE_VARIANTS: Record<UserListStatusFilter, "statusActive" | "statusPending" | "statusInactive"> = {
  active: "statusActive",
  inactive: "statusInactive",
  must_change_password: "statusPending",
};

/** Header cells: muted 13px, sentence case, same horizontal padding as the body cells. */
const HEAD_CELL_CLASS = "h-10 px-4 text-meta font-medium text-muted-foreground";
const BODY_CELL_CLASS = "px-4 py-3";

/** The panel that holds the table and its empty state (Paper, 12px radius). */
export const USERS_PANEL_CLASS = "overflow-hidden rounded-xl border bg-card";

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
 * On narrow screens the table scrolls horizontally inside its panel.
 */
export function UsersTable({ users, currentUserId, actions }: UsersTableProps): React.JSX.Element {
  if (users.length === 0) {
    return <EmptyUsersState />;
  }

  return (
    <div className={USERS_PANEL_CLASS}>
      <Table className="text-body">
        <TableHeader className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            <TableHead className={HEAD_CELL_CLASS}>Nombre</TableHead>
            <TableHead className={HEAD_CELL_CLASS}>Correo</TableHead>
            <TableHead className={HEAD_CELL_CLASS}>Rol</TableHead>
            <TableHead className={HEAD_CELL_CLASS}>Estado</TableHead>
            <TableHead className={HEAD_CELL_CLASS}>Último acceso</TableHead>
            <TableHead className={HEAD_CELL_CLASS}>
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
    </div>
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
    <TableRow className="hover:bg-accent/60">
      <TableCell className={`${BODY_CELL_CLASS} font-medium`}>{user.name}</TableCell>
      <TableCell className={`${BODY_CELL_CLASS} text-muted-foreground`}>{user.email}</TableCell>
      <TableCell className={BODY_CELL_CLASS}>{getRoleLabel(user.role)}</TableCell>
      <TableCell className={BODY_CELL_CLASS}>
        <Badge variant={STATUS_BADGE_VARIANTS[displayStatus]} className="h-6 px-2.5 text-meta">
          {USER_STATUS_LABELS[displayStatus]}
        </Badge>
      </TableCell>
      <TableCell className={BODY_CELL_CLASS}>
        <LastLogin lastLoginAt={user.lastLoginAt} />
      </TableCell>
      <TableCell className={`${BODY_CELL_CLASS} py-2`}>
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
    <div className="flex justify-end gap-1">
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

/** "Último acceso": tabular digits so dates line up; "Nunca" is muted. */
function LastLogin({ lastLoginAt }: { lastLoginAt: Date | null }): React.JSX.Element {
  if (!lastLoginAt) {
    return <span className="text-muted-foreground">{NEVER_LOGGED_IN_LABEL}</span>;
  }
  return <span className="tabular-nums">{LAST_LOGIN_FORMATTER.format(lastLoginAt)}</span>;
}

function EmptyUsersState(): React.JSX.Element {
  return (
    <div className={`${USERS_PANEL_CLASS} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
      <SearchXIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <p className="text-muted-foreground">{NO_USERS_FOUND_MESSAGE}</p>
      <Link href={USERS_PATH} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {CLEAR_FILTERS_LABEL}
      </Link>
    </div>
  );
}
