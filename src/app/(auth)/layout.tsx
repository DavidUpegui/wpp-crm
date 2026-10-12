/**
 * Layout of the screens used before entering the app (login, change
 * password): a narrow card centered on the page. It reads no session.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        {children}
      </div>
    </main>
  );
}
