import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HMARL Smart Grid Simulator",
  description:
    "A forecast-driven multi-agent smart grid simulator based on hierarchical MARL research.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
