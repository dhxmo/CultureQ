"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlaidLink from "../../components/PlaidLink";
import { useAuth } from "../../contexts/AuthContext";

export default function OnboardingPage() {
  const [step, setStep] = useState<"consent" | "connect" | "success">(
    "consent",
  );
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const handleConsentAccept = () => {
    setStep("connect");
  };

  const handlePlaidSuccess = (newUserId: string, itemId: string) => {
    setStep("success");
    // Store user session data using AuthContext
    login(newUserId, itemId);
  };

  const handlePlaidError = (error: Error) => {
    setError(error.message || "Failed to connect bank account");
  };

  const handleContinue = () => {
    router.push("/dashboard");
  };

  if (step === "consent") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to cultureQ
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your personalized rewards platform
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Privacy & Data Processing Consent
                </h3>
                <div className="space-y-4 text-sm text-gray-600">
                  <p>To provide personalized cashback offers, we need to:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Securely connect to your bank account via Plaid</li>
                    <li>Analyze your transaction patterns (anonymized)</li>
                    <li>Create a cultural taste profile using Qloo</li>
                    <li>Generate personalized offers from partner merchants</li>
                  </ul>
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900">
                      Your Data Protection:
                    </h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>All sensitive data is encrypted at rest</li>
                      <li>Transaction data is anonymized before analysis</li>
                      <li>You can block offers from specific merchants</li>
                      <li>You can delete your data at any time</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleConsentAccept}
                  className="cursor-pointer flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  I Accept & Continue
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="cursor-pointer flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "connect") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connect Your Bank Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Securely connect via Plaid to start receiving personalized offers
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="text-center">
                <PlaidLink
                  onSuccess={handlePlaidSuccess}
                  onError={handlePlaidError}
                  className="cursor-pointer w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Connect Bank Account
                </PlaidLink>
              </div>

              <div className="text-xs text-gray-500 text-center">
                <p>🔒 Your banking credentials are never stored by cultureQ.</p>
                <p>We use bank-level security through Plaid.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
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
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Account Connected!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your bank account has been securely connected. We&apos;ll start
              analyzing your transactions to create your personalized taste
              profile.
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="space-y-6">
              <div className="text-sm text-gray-600">
                <h3 className="font-medium text-gray-900 mb-2">
                  What happens next:
                </h3>
                <ul className="space-y-1">
                  <li>• We&apos;ll analyze your recent transactions</li>
                  <li>• Create your cultural taste profile</li>
                  <li>• Start generating personalized offers</li>
                  <li>• You can refine your profile through conversations</li>
                </ul>
              </div>

              <button
                onClick={handleContinue}
                className="cursor-pointer w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
