# WorkOS administration

## Connect from Codex Cloud

Use the OAuth device flow if `codex mcp login workos` sends the browser to `127.0.0.1` and the connection is refused. In the staging setup, the browser and the Codex process had separate loopback interfaces. Submitting the callback manually reached Codex, but its managed credential directory was read-only. The device flow lets the admin approve in a browser while a temporary HTTP client in the project environment talks to the official WorkOS MCP server. Keep the MCP registration in the [project config](../.codex/config.toml). This procedure creates a temporary authenticated connection for the current environment. A future session may need a new authorization.

1. Discover the authorization server from the MCP protected-resource metadata and use its OAuth discovery document for the registration, device authorization, and token endpoints. In the verified setup the issuer was `https://signin.workos.com`. [Resource metadata](https://mcp.workos.com/.well-known/oauth-protected-resource/mcp) · [OAuth discovery](https://signin.workos.com/.well-known/oauth-authorization-server)
2. Register a public OAuth client for the project. POST JSON to the issuer's registration endpoint and retain the returned `client_id`. The built-in Codex OAuth client returned `unauthorized_client` for device authorization. The following registration worked for ExitSlide. The loopback URI is registration metadata for the authorization-code grant. Device authorization needs no callback listener.

   ```json
   {
     "client_name": "ExitSlide Codex project",
     "token_endpoint_auth_method": "none",
     "redirect_uris": ["http://127.0.0.1:46251/callback"],
     "response_types": ["code"],
     "grant_types": [
       "authorization_code",
       "refresh_token",
       "urn:ietf:params:oauth:grant-type:device_code"
     ]
   }
   ```

3. POST form data to the device authorization endpoint with `client_id`, `resource=https://mcp.workos.com/mcp`, and the scopes `email mcp offline_access openid profile`. Have the admin open the returned `verification_uri_complete`, or open `verification_uri` and enter the `user_code`. The admin signs in to the WorkOS workspace that owns ExitSlide. Keep the separate `device_code` in the client environment.
4. Poll the token endpoint with form fields `grant_type=urn:ietf:params:oauth:grant-type:device_code`, `client_id`, `device_code`, and the same `resource`. Use the returned polling interval and expiry. Continue on `authorization_pending`, slow down on `slow_down`, and stop if denied or expired.
5. **Refresh for the MCP resource before connecting.** The device exchange returned a refresh token, but its first access token had the OAuth client as its audience and MCP returned HTTP 401. POST to the token endpoint again with form fields `grant_type=refresh_token`, `client_id`, `refresh_token`, and `resource=https://mcp.workos.com/mcp`. Use the resulting access token, whose audience is the MCP endpoint, and retain the new refresh token if one is returned.
6. Use the refreshed token as `Authorization: Bearer <access_token>` with an MCP Streamable HTTP client at `https://mcp.workos.com/mcp`. Complete the MCP initialization handshake and call `tools/list` to verify access. Call `whoami` and match the environment's client ID to ExitSlide's configured `WORKOS_CLIENT_ID` before changing settings. WorkOS environment names can repeat across projects.

Keep the device code and tokens in memory or in a private temporary directory outside the checkout. Use directory permissions `0700` and file permissions `0600` if storing them on disk. Remove temporary credentials when finished. The device-flow credentials are separate from the staging smoke test API key. [WorkOS MCP setup](https://workos.com/docs/mcp)

## Set the staging sign-out URI through MCP

After matching the staging environment by client ID, use `defaultAuthkitApplication` to read the application ID, client ID, and current logout URIs. Verify the application's client ID matches `WORKOS_CLIENT_ID`. The `setAuthkitApplicationLogoutUris` operation replaces the full list, so preserve any existing entries and their IDs. Mark the staging homepage as the single default.

Use `list_operations` to check the current mutation schema. Validate with `dryRun: true`, then apply and query the application again to confirm the default URI. Run the live staging smoke to verify that a single sign-out returns to ExitSlide and the dashboard requires a new sign-in. [Staging setup](admin.md#workos-staging-and-frontend-deployment) · [Pilot checklist](pilot.md#staging-checks)
