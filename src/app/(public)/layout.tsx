import { ClerkProvider } from "@clerk/nextjs";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/collections"
      signUpFallbackRedirectUrl="/collections"
    >
      {children}
    </ClerkProvider>
  );
}
