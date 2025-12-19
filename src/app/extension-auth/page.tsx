"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Extension auth page
 *
 * This page is opened from the Chrome extension when a user needs to sign in.
 * After authentication, Clerk's Sync Host feature automatically syncs the
 * session to the extension, so we just need to show a success message.
 */
export default function ExtensionAuthPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setShowSuccess(true);
      // Give Clerk a moment to sync the session to the extension
      // Then we can close the tab or show success
      const timer = setTimeout(() => {
        // Try to close the tab (works if opened by extension)
        window.close();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Signed in successfully!
          </h1>
          <p className="text-gray-600 mb-4">
            You can now use the Tote extension to save products.
          </p>
          <p className="text-sm text-gray-500">
            This tab will close automatically...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sign in to Tote
          </h1>
          <p className="text-gray-600">
            Sign in to save products from the Chrome extension
          </p>
        </div>

        <SignIn
          routing="hash"
          afterSignInUrl="/extension-auth"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}
