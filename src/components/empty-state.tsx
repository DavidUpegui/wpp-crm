import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Lucide icon shown in the muted circle above the title. */
  icon: LucideIcon;
  title: string;
  /** Optional one-line explanation under the title. */
  description?: string;
  /** Optional call to action (usually a link styled as a button). */
  action?: React.ReactNode;
  /**
   * 1 when the empty state IS the page (its title is the page title, e.g. the
   * forbidden view); 2 when it sits under the page's own h1 (placeholders).
   */
  headingLevel?: 1 | 2;
  /** Extra layout classes from the caller (spacing, a top divider…). */
  className?: string;
};

/**
 * The quiet empty state shared by the placeholder pages and the forbidden view
 * (plan §7b: everything except the login panel stays calm): a muted icon, a
 * Pine-ink title, an optional explanation and an optional action, left-aligned.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={cn("flex max-w-md flex-col items-start gap-3", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <EmptyStateTitle title={title} headingLevel={headingLevel} />
      {description && <p className="text-body text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

function EmptyStateTitle({ title, headingLevel }: { title: string; headingLevel: 1 | 2 }): React.JSX.Element {
  if (headingLevel === 1) {
    return <h1 className="text-page font-semibold tracking-tight text-title">{title}</h1>;
  }

  return <h2 className="text-section font-semibold text-title">{title}</h2>;
}
