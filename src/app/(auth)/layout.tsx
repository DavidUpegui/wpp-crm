import { AuthConversationPanel } from "@/components/auth-conversation-panel";

/**
 * Layout of the screens used before entering the app (login, change
 * password): the pine-ink conversation panel next to the form (plan §7b).
 * On small screens the panel shrinks to a header strip and the form follows.
 * It reads no session.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col md:grid md:grid-cols-2">
      <AuthConversationPanel />
      <main className="flex flex-1 items-center justify-center bg-card px-6 py-10 text-card-foreground md:px-12">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
