import type { Metadata } from "next";
import { Providers } from "./providers";
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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
