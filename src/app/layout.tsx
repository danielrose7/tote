import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: {
    template: "%s — Tote",
    default: "Tote — One place, every store",
  },
  description:
    "Save products from any online store in one place. Organize with collections, track prices, and share wishlists — all with complete privacy.",
  metadataBase: new URL("https://tote.tools"),
  openGraph: {
    siteName: "Tote",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
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
