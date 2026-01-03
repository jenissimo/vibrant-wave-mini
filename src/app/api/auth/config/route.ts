import { NextResponse } from 'next/server';

export async function GET() {
  const isOIDCConfigured = !!(
    process.env.OIDC_ISSUER_URL &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET
  );

  return NextResponse.json({ 
    oidcEnabled: isOIDCConfigured,
    oidcLogoutUri: process.env.OIDC_LOGOUT_URI || null
  });
}

