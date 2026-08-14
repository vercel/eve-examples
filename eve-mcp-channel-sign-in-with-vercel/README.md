# eve MCP channel with Sign in with Vercel

A minimal [eve](https://eve.dev) agent exposed as a Streamable HTTP MCP server at `/mcp`. The channel uses [Sign in with Vercel](https://vercel.com/docs/sign-in-with-vercel) as its OAuth authorization server.

When an MCP client connects, it discovers the protected-resource metadata, sends the user through Vercel's OAuth flow, and calls the agent with the resulting access token. The channel validates the opaque access token with Vercel's token introspection endpoint and uses the verified Vercel user ID as the eve principal.

This is user authentication through Sign in with Vercel. It is different from `vercelOidc()`, which authenticates Vercel workloads and deployments.

## Run locally

Install dependencies, link a Vercel project so the agent can use AI Gateway, and start eve:

```bash
pnpm install
vercel link
vercel env pull
pnpm dev
```

The local MCP endpoint is `http://localhost:2000/mcp`.

## Deploy

```bash
pnpm exec eve deploy
```

The deployed MCP endpoint is `https://<your-deployment>/mcp`. Add that URL to any MCP client that supports Streamable HTTP and OAuth. For example, a typical MCP configuration is:

```json
{
  "mcpServers": {
    "eve-sign-in-with-vercel": {
      "url": "https://<your-deployment>/mcp"
    }
  }
}
```

The MCP client should open Vercel's consent page automatically. No Vercel App client secret is stored by this resource server: compatible MCP clients register with the authorization server and use PKCE.

## How authentication works

`agent/channels/mcp.ts` combines three small pieces:

1. `oauthResource(...)` publishes `/.well-known/oauth-protected-resource` and advertises `https://vercel.com` as the authorization server.
2. The custom `AuthFn` extracts the bearer access token and validates it with Vercel's introspection endpoint.
3. An active token issued by `https://vercel.com` becomes an eve user principal keyed by the token's `sub` claim. eve then applies principal ownership to durable invocations.

Sign in with Vercel access tokens are bearer credentials. Do not log them, include them in URLs, or expose them to browser JavaScript.
