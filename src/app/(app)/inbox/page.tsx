import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = {
  title: "Bandeja · WPP CRM",
};

/** Placeholder until the conversaciones de WhatsApp section is built (FR-019). Static: reads no session. */
export default function InboxPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-page font-semibold tracking-tight text-title">Bandeja</h1>
      <EmptyState
        icon={MessageCircle}
        title="Próximamente"
        description="Aquí verás las conversaciones de WhatsApp con tus clientes y podrás responderlas."
        className="border-t pt-8"
      />
    </div>
  );
}
