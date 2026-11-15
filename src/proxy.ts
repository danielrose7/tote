import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/collections(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // English is the unprefixed default, so /en/... is a duplicate URL: send it
  // to the canonical one rather than serving the same page twice.
  const { pathname, search } = req.nextUrl;
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    url.search = search;
    return NextResponse.redirect(url, 308);
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
