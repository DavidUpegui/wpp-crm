import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contactos · WPP CRM",
};

/** Placeholder until the contactos section is built (FR-019). Static: reads no session. */
export default function ContactsPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Contactos</h1>
      <p className="text-muted-foreground">Próximamente</p>
    </div>
  );
}
