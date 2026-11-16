import { UseCasesLayout } from './UseCasesLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <UseCasesLayout locale="en">{children}</UseCasesLayout>;
}
