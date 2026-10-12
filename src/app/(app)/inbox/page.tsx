import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bandeja · WPP CRM",
};

/** Placeholder until the conversaciones de WhatsApp section is built (FR-019). Static: reads no session. */
export default function InboxPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Bandeja</h1>
      <p className="text-muted-foreground">Próximamente</p>
    </div>
  );
}
