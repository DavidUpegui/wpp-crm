import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const HOME_PATH = "/inbox";

/**
 * Screen shown when a logged-in user opens a page their role does not allow,
 * e.g. an agent opening user management by its address (AC-3.3).
 */
export function ForbiddenView(): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">No tienes permiso para ver esta página</h1>
      <Link href={HOME_PATH} className={buttonVariants({ variant: "outline" })}>
        Volver a la bandeja
      </Link>
    </div>
  );
}
