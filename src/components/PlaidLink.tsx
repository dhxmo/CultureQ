'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink, PlaidLinkError } from 'react-plaid-link';

interface PlaidLinkProps {
  onSuccess: (userId: string, itemId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function PlaidLink({ onSuccess, onError, className, children }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create link token when component mounts
  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: 'temp-user-id', // We'll get real user ID after authentication
          }),
        });

        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error creating link token:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to create link token'));
      }
    };

    createLinkToken();
  }, [onError]);

  // Handle successful link
  const handleOnSuccess = useCallback(
    async (public_token: string) => {
      setLoading(true);
      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_token }),
        });

        const data = await response.json();
        
        if (data.success) {
          onSuccess(data.userId, data.itemId);
        } else {
          throw new Error(data.error || 'Token exchange failed');
        }
      } catch (error) {
        console.error('Error exchanging token:', error);
        onError?.(error as Error);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError]
  );

  // Handle link errors
  const handleOnExit = useCallback(
    (err: PlaidLinkError | null) => {
      if (err) {
        console.error('Plaid Link error:', err);
        onError?.(new Error(err.error_message || 'Plaid Link error'));
      }
    },
    [onError]
  );

  const config = {
    token: linkToken,
    onSuccess: handleOnSuccess,
    onExit: handleOnExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready && !loading) {
      open();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!ready || loading}
      className={className || 'bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50'}
    >
      {loading ? 'Connecting...' : children || 'Connect Bank Account'}
    </button>
  );
}