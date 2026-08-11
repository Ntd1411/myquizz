/**
 * Writes the OpenAPI document to docs/openapi.json.
 *
 * Only JSON is emitted: the previous hand-rolled Markdown renderer duplicated
 * what the reference UI already shows and drifted from the spec.
 */

import fs from 'fs'
import path from 'path'
import { openapiSpec } from './openapi.js'

const outputDir = path.join(process.cwd(), 'docs')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const jsonPath = path.join(outputDir, 'openapi.json')
fs.writeFileSync(jsonPath, JSON.stringify(openapiSpec, null, 2))
console.log(`API specification exported to: ${jsonPath}`)
