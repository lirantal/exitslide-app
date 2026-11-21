import console from 'node:console'
import process from 'node:process'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const temporary = mkdtempSync(join(tmpdir(), 'exitslide-e2e-'))
const state = join(temporary, 'state')
const env = {
  ...process.env,
  EXITSLIDE_LOCAL_STATE: state,
  EXITSLIDE_E2E_ENV_DIR: temporary,
  XDG_CONFIG_HOME: join(temporary, 'config'),
}

function clean() {
  rmSync(temporary, { recursive: true, force: true })
}

writeFileSync(join(temporary, '.dev.vars'), [
  'WORKOS_CLIENT_ID=client_testfixture',
  'WORKOS_REDIRECT_URI=http://127.0.0.1:3100/auth/callback',
  'WORKOS_COOKIE_PASSWORD=test-fixture-value-for-local-browser-tests',
].join('\n'), { mode: 0o600 })

const migration = spawnSync(join(root, 'node_modules/.bin/cf'), [
  'd1', 'migrations', 'apply', '00000000-0000-4000-8000-000000000001',
  '--local', '--persist-to', state, '--dir', 'backend/drizzle',
], { cwd: root, env, stdio: 'inherit' })
if (migration.status !== 0) {
  clean()
  process.exit(1)
}

const frontend = join(root, 'frontend')
const vite = spawn(join(frontend, 'node_modules/.bin/vite'), [
  'dev', '--config', 'e2e/vite.config.ts', '--host', '127.0.0.1', '--port', '3100',
], { cwd: frontend, env, stdio: 'inherit' })

vite.once('error', error => {
  console.error(error.message)
  clean()
  process.exitCode = 1
})
vite.once('exit', code => {
  clean()
  process.exitCode = code ?? 0
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => vite.kill(signal))
}
