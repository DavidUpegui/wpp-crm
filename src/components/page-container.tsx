/** Same width and padding the app pages had inside the old AppShell wrapper (plan §7b). */
const PAGE_CONTAINER_CLASSES = "flex w-full max-w-[1100px] flex-1 flex-col px-4 py-6 sm:px-6 md:px-10 md:py-10";

type PageContainerProps = {
  children: React.ReactNode;
};

/**
 * Standard content column for app pages: max 1100px wide with the workspace
 * padding. It lives in each page instead of in `AppShell` so pages choose
 * their width — the inbox needs the full width and height of the screen,
 * while forms and lists read better in a bounded column.
 */
export function PageContainer({ children }: PageContainerProps): React.JSX.Element {
  return <div className={PAGE_CONTAINER_CLASSES}>{children}</div>;
}
