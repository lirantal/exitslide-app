import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.cloudflare/**', '**/.tanstack/**', '**/routeTree.gen.ts'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
)
