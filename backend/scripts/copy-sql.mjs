// Copies .sql assets from src into dist after tsc.
//
// tsc only emits JavaScript, so SQL files referenced at runtime through
// path.join(__dirname, ...) are missing from the compiled output. Without this
// step migrations fail on the server with ENOENT while working fine in dev,
// where tsx runs straight from src.
//
// Implemented with plain node APIs so it behaves the same on Windows and Linux.
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(backendRoot, 'src')
const distDir = join(backendRoot, 'dist')

if (!existsSync(distDir)) {
  console.error('dist/ not found. Run tsc before copying assets.')
  process.exit(1)
}

let copied = 0

function copySqlFiles(from, to) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name)
    const target = join(to, entry.name)

    if (entry.isDirectory()) {
      copySqlFiles(source, target)
    } else if (entry.name.endsWith('.sql')) {
      mkdirSync(to, { recursive: true })
      copyFileSync(source, target)
      copied += 1
      console.log(`  ${relative(backendRoot, target)}`)
    }
  }
}

console.log('Copying .sql assets into dist:')
copySqlFiles(srcDir, distDir)

if (copied === 0) {
  console.error('No .sql files were found under src/. Migrations would fail at runtime.')
  process.exit(1)
}

console.log(`Copied ${copied} SQL file(s).`)
