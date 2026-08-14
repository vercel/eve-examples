import {
  extractBearerToken,
  oauthResource,
  type AuthFn,
  withAuthChallenges,
} from "eve/channels/auth";
import { mcpChannel } from "eve/channels/mcp";

const VERCEL_ISSUER = "https://vercel.com";
const VERCEL_INTROSPECTION_ENDPOINT =
  "https://api.vercel.com/login/oauth/token/introspect";

interface VercelTokenIntrospection {
  active?: unknown;
  client_id?: unknown;
  iss?: unknown;
  sub?: unknown;
  token_type?: unknown;
}

const verifySignInWithVercel: AuthFn<Request> = async (request) => {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (token === null) return null;

  const response = await fetch(VERCEL_INTROSPECTION_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Vercel token introspection failed with status ${response.status}.`);
  }

  const result = (await response.json()) as VercelTokenIntrospection;
  if (
    result.active !== true ||
    result.iss !== VERCEL_ISSUER ||
    result.token_type !== "bearer" ||
    typeof result.sub !== "string" ||
    result.sub.length === 0
  ) {
    return null;
  }

  const attributes: Record<string, string> = {};
  if (typeof result.client_id === "string") {
    attributes.oauthClientId = result.client_id;
  }

  return {
    attributes,
    authenticator: "sign-in-with-vercel",
    principalId: result.sub,
    principalType: "user",
  };
};

const signInWithVercel = withAuthChallenges(
  verifySignInWithVercel,
  [{ scheme: "Bearer" }],
);

export default mcpChannel({
  auth: oauthResource(signInWithVercel, {
    issuer: VERCEL_ISSUER,
    scopes: ["openid"],
  }),
});
