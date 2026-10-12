import { FileText } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Plantillas · WPP CRM",
};

/** Placeholder until the plantillas de mensajes section is built (FR-019). Static: reads no session. */
export default function TemplatesPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-page font-semibold tracking-tight text-title">Plantillas</h1>
      <EmptyState
        icon={FileText}
        title="Próximamente"
        description="Aquí podrás crear y enviar las plantillas de mensajes de WhatsApp."
        className="border-t pt-8"
      />
    </div>
  );
}
