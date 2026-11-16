import { DocsLayout } from './DocsLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout locale="en">{children}</DocsLayout>;
}
