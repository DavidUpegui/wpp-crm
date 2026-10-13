import type { DeliveryFailureReason } from "@/modules/conversations/domain/message";

/**
 * Spanish reason shown after "No enviado" when WhatsApp did not accept a reply
 * (AC-5.5, spec §12). The UI adds the "No enviado" label itself, so these texts
 * do not repeat it. A `Record` so a new failure reason fails typecheck until it
 * has a message.
 */
export const FAILURE_REASON_MESSAGES: Record<DeliveryFailureReason, string> = {
  outside_window: "La ventana de 24 h está cerrada.",
  recipient_not_allowed:
    "Este número no está en la lista de destinatarios permitidos del número de prueba.",
  undeliverable: "WhatsApp no pudo entregar el mensaje a este número.",
  rate_limited: "Se enviaron demasiados mensajes seguidos. Espera un momento e inténtalo de nuevo.",
  access_token_invalid: "Hay un problema con la conexión a WhatsApp. Contacta a un administrador.",
  unknown: "WhatsApp no aceptó el mensaje. Inténtalo de nuevo más tarde.",
};
