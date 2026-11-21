#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

worker=exitslide-frontend
tag=$(pnpm exec cf workers get "$worker" | jq -er --arg worker "$worker" 'select(.name == $worker) | .id')
current=$(pnpm exec cf builds workers get "$tag")
if ! jq -e '.git_repository |
  .provider_type == "github" and .provider_account_name == "lirantal" and
  .repo_name == "exitslide-app" and .branch == "main"' <<< "$current" >/dev/null; then
  echo 'Connect exitslide-frontend to lirantal/exitslide-app with main as the production branch first.' >&2
  exit 1
fi

production_token=$(jq -er '.production_settings.build_token_uuid' <<< "$current")
preview_token=$(jq -er '.previews_base_config.build_token_uuid' <<< "$current")
settings=$(jq --arg production "${EXITSLIDE_BUILDS_TOKEN_UUID:-$production_token}" \
  --arg preview "${EXITSLIDE_BUILDS_TOKEN_UUID:-$preview_token}" '
  .production_settings.build_token_uuid = $production |
  .previews_base_config.build_token_uuid = $preview' ops/cloudflare/preview-builds.json)

patch_previews=()
if jq -e '.previews_enabled' <<< "$current" >/dev/null && jq -e '.previews_enabled' <<< "$settings" >/dev/null; then
  patch_previews=(--patch-existing-previews true)
fi
pnpm exec cf builds workers edit "$tag" --body "$settings" "${patch_previews[@]}" >/dev/null
pnpm exec cf builds workers get "$tag" |
  jq '{previews_enabled, production_deploy:.production_settings.deploy_command,
    preview_build:.previews_base_config.build_command, preview_deploy:.previews_base_config.deploy_command,
    preview_paths:.previews_base_config.path_includes}'
