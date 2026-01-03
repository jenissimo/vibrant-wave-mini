'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if OIDC is configured
    fetch('/api/auth/config')
      .then(res => res.json())
      .then(data => {
        setOidcEnabled(data.oidcEnabled);
        // If OIDC is enabled, automatically redirect to OIDC sign-in
        if (data.oidcEnabled) {
          signIn('oidc', { callbackUrl: '/' });
        }
      })
      .catch(() => {
        setOidcEnabled(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials');
      } else {
        router.push('/');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking OIDC configuration
  if (oidcEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Vibrant Wave Editor</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  // If OIDC is enabled, show redirecting message (signIn will handle redirect)
  if (oidcEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Vibrant Wave Editor</h1>
            <p className="text-muted-foreground">Redirecting to sign in...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show credentials form if OIDC is not configured
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Vibrant Wave Editor</h1>
            <p className="text-muted-foreground">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
