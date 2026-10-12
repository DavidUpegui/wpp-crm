import { Contact } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Contactos · WPP CRM",
};

/** Placeholder until the contactos section is built (FR-019). Static: reads no session. */
export default function ContactsPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-page font-semibold tracking-tight text-title">Contactos</h1>
      <EmptyState
        icon={Contact}
        title="Próximamente"
        description="Aquí podrás consultar tus contactos con sus etiquetas y notas."
        className="border-t pt-8"
      />
    </div>
  );
}
