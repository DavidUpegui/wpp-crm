import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

// One family for the whole app (plan §7b); latin-ext covers Spanish accents.
const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "WPP CRM",
  description: "CRM para gestionar conversaciones de WhatsApp con clientes",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
