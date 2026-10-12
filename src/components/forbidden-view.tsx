import { Lock } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

const HOME_PATH = "/inbox";

/**
 * Screen shown when a logged-in user opens a page their role does not allow,
 * e.g. an agent opening user management by its address (AC-3.3). Same quiet
 * empty-state style as the placeholder pages; here its title is the page title.
 */
export function ForbiddenView(): React.JSX.Element {
  return (
    <EmptyState
      icon={Lock}
      title="No tienes permiso para ver esta página"
      headingLevel={1}
      className="gap-4"
      action={
        <Link href={HOME_PATH} className={buttonVariants({ variant: "outline" })}>
          Volver a la bandeja
        </Link>
      }
    />
  );
}
