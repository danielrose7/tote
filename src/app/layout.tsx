import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "tote - One place, every store",
  description: "Save and organize product links you want to remember",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
