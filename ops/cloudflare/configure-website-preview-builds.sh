#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

operation=${1:-edit}
case "$operation" in
  create|edit) ;;
  *) echo "Usage: $0 [create|edit]" >&2; exit 2 ;;
esac

worker_tag() {
  pnpm exec cf workers get "$1" | jq -er --arg name "$1" 'select(.name == $name) | .id'
}

tag=$(worker_tag exitslide-website)
frontend_tag=$(worker_tag exitslide-frontend)
frontend=$(pnpm exec cf builds workers get "$frontend_tag")
repository=$(jq -ce '.git_repository | select(
  .provider_type == "github" and .provider_account_name == "lirantal" and
  .repo_name == "exitslide-app" and .branch == "main"
) | {provider_type, provider_account_id, provider_account_name, repo_id, repo_name, branch}' <<< "$frontend")
build_token=$(jq -er '.previews_base_config.build_token_uuid' <<< "$frontend")
settings=$(jq --arg token "${EXITSLIDE_BUILDS_TOKEN_UUID:-$build_token}" '
  .production_settings.build_token_uuid = $token |
  .previews_base_config.build_token_uuid = $token
' ops/cloudflare/website-preview-builds.json)

if [[ "$operation" == create ]]; then
  settings=$(jq --arg tag "$tag" --argjson repository "$repository" '
    . + {script_tag: $tag, git_repository: $repository}
  ' <<< "$settings")
  pnpm exec cf builds workers create "$tag" --body "$settings" >/dev/null
else
  current=$(pnpm exec cf builds workers get "$tag")
  if ! jq -e --argjson expected "$repository" '
    .git_repository | {provider_type, provider_account_id, provider_account_name, repo_id, repo_name, branch} == $expected
  ' <<< "$current" >/dev/null; then
    echo 'The website Worker has an unexpected repository or production branch.' >&2
    exit 1
  fi
  patch_previews=()
  if jq -e '.previews_enabled' <<< "$current" >/dev/null; then
    patch_previews=(--patch-existing-previews true)
  fi
  pnpm exec cf builds workers edit "$tag" --body "$settings" "${patch_previews[@]}" >/dev/null
fi

pnpm exec cf builds workers get "$tag" |
  jq '{previews_enabled, production_deploy:.production_settings.deploy_command,
    preview_build:.previews_base_config.build_command, preview_deploy:.previews_base_config.deploy_command,
    preview_paths:.previews_base_config.path_includes}'
