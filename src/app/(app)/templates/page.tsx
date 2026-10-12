import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plantillas · WPP CRM",
};

/** Placeholder until the plantillas de mensajes section is built (FR-019). Static: reads no session. */
export default function TemplatesPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Plantillas</h1>
      <p className="text-muted-foreground">Próximamente</p>
    </div>
  );
}
