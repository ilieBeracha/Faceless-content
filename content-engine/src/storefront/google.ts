/**
 * "Sign in with Google", done entirely by redirects (no scripts from Google on our pages):
 * we send the browser to Google, Google sends it back with a one-time code, and the server swaps
 * that code for the person's identity.
 */
import type { Identity } from "./accounts.ts";

export interface SignIn {
  /** Where to send the browser to sign in. `state` comes back unchanged with the code. */
  startUrl(redirectUri: string, state: string): string;
  /** Swap the one-time code for who signed in. Throws if the provider refuses it. */
  identity(code: string, redirectUri: string): Promise<Identity>;
}

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export function googleSignIn(clientId: string, clientSecret: string): SignIn {
  return {
    startUrl(redirectUri, state) {
      return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" })}`;
    },
    async identity(code, redirectUri) {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      if (!res.ok) throw new Error(`Google refused the sign-in code (HTTP ${res.status}).`);
      const { id_token } = (await res.json()) as { id_token?: string };
      if (!id_token) throw new Error("Google's answer had no identity in it.");
      // The token came straight from Google over HTTPS in answer to our own secret, so its claims are read as they are.
      const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString("utf8")) as { iss?: string; aud?: string; sub?: string; email?: string; email_verified?: boolean; name?: string };
      if (!claims.iss || !ISSUERS.includes(claims.iss) || claims.aud !== clientId) throw new Error("That identity was not issued by Google for this site.");
      if (!claims.sub || !claims.email || claims.email_verified !== true) throw new Error("Google did not confirm an email address for that account.");
      return { sub: claims.sub, email: claims.email, name: claims.name ?? claims.email };
    },
  };
}
