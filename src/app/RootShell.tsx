import '../index.css';

/**
 * The <html>/<body> shell. There is no top-level app/layout.tsx: each route
 * group owns a root layout and passes its language here, so <html lang> is
 * correct in the static HTML (what search engines read) rather than patched
 * after hydration.
 */
export function RootShell({
  lang,
  children,
}: {
  lang: string;
  children: React.ReactNode;
}) {
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
