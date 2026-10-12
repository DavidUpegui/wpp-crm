import { cn } from "@/lib/utils";

type ChatSender = "customer" | "agent";

type SampleChatMessage = {
  sender: ChatSender;
  text: string;
  sentAt: string;
};

/** A short, realistic exchange that shows what the tool is for at a glance. */
const SAMPLE_CONVERSATION: readonly SampleChatMessage[] = [
  { sender: "customer", text: "Hola, ¿mi pedido ya salió?", sentAt: "9:41" },
  { sender: "agent", text: "Sí, sale hoy. Te envío la guía en un momento.", sentAt: "9:42" },
  { sender: "customer", text: "¡Gracias!", sentAt: "9:42" },
];

const BUBBLE_BASE_CLASSES =
  "relative flex max-w-[85%] items-end gap-3 rounded-bubble px-3.5 py-2 text-body leading-snug before:absolute before:bottom-0 before:size-2.5";

// The tail is a small triangle glued to the bottom corner of the speaking side.
const BUBBLE_CLASSES_BY_SENDER: Record<ChatSender, string> = {
  customer:
    "self-start rounded-bl-none bg-card text-card-foreground before:-left-2.5 before:bg-card before:[clip-path:polygon(100%_0,100%_100%,0_100%)]",
  agent:
    "self-end rounded-br-none bg-accent text-accent-foreground before:-right-2.5 before:bg-accent before:[clip-path:polygon(0_0,100%_100%,0_100%)]",
};

/**
 * Pine-ink side of the login and change-password screens (plan §7b): the
 * app's wordmark, a sample WhatsApp exchange and one sentence saying what the
 * tool is for. On small screens it collapses to a header strip with only the
 * wordmark, so the form comes first. The chat bubbles are decorative and
 * hidden from assistive technology; the wordmark and sentence stay readable.
 */
export function AuthConversationPanel(): React.JSX.Element {
  return (
    <header className="flex flex-col bg-sidebar px-6 py-4 text-sidebar-foreground md:justify-between md:gap-12 md:px-12 md:py-12">
      <p className="text-body font-semibold tracking-tight md:text-section">WPP CRM</p>

      <SampleConversation />

      <p className="hidden max-w-[17ch] text-display font-semibold tracking-tight text-balance md:block">
        Atiende las conversaciones de WhatsApp de tus clientes en equipo.
      </p>
    </header>
  );
}

function SampleConversation(): React.JSX.Element {
  return (
    <div aria-hidden="true" className="hidden w-full max-w-sm flex-col gap-3 md:flex">
      {SAMPLE_CONVERSATION.map((message) => (
        <div key={`${message.sender}-${message.text}`} className={cn(BUBBLE_BASE_CLASSES, BUBBLE_CLASSES_BY_SENDER[message.sender])}>
          <span>{message.text}</span>
          <span className="shrink-0 text-meta text-muted-foreground tabular-nums">{message.sentAt}</span>
        </div>
      ))}
    </div>
  );
}
