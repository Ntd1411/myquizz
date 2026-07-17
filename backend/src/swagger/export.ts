import { swaggerSpec } from './swagger.config.js'
import fs from 'fs'
import path from 'path'

interface Parameter {
  name: string
  in: string
  description?: string
  required?: boolean
  schema?: unknown
}

interface RequestBody {
  content?: {
    [mediaType: string]: {
      schema?: unknown
    }
  }
}

interface Response {
  description?: string
  content?: {
    [mediaType: string]: {
      schema?: unknown
    }
  }
}

interface PathItem {
  summary?: string
  tags?: string[]
  security?: unknown[]
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses?: {
    [statusCode: string]: Response
  }
}

interface OpenAPISpec {
  info: {
    title: string
    version: string
    description?: string
  }
  servers?: Array<{
    url: string
  }>
  paths?: {
    [path: string]: {
      [method: string]: PathItem
    }
  }
}

function generateMarkdown(spec: OpenAPISpec): string {
  let markdown = `# ${spec.info.title}\n\n`
  markdown += `${spec.info.description || ''}\n\n`
  markdown += `**Version:** ${spec.info.version}\n\n`
  markdown += `**Base URL:** ${spec.servers?.[0]?.url || ''}\n\n`

  markdown += '## Authentication\n\n'
  markdown += 'API sử dụng Cookie-based authentication với HTTP-only cookies.\n\n'

  markdown += '## Endpoints\n\n'

  const paths = spec.paths || {}

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, details] of Object.entries(methods)) {
      const methodUpper = method.toUpperCase()
      const summary = details.summary || ''
      const tags = details.tags?.join(', ') || ''

      markdown += `### ${methodUpper} ${path}\n\n`
      markdown += `**Summary:** ${summary}\n\n`
      markdown += `**Tags:** ${tags}\n\n`

      if (details.security) {
        markdown += '**Authentication:** Required\n\n'
      }

      if (details.parameters) {
        markdown += '**Parameters:**\n\n'
        details.parameters.forEach((param) => {
          markdown += `- \`${param.name}\` (${param.in}): ${param.description || ''}\n`
        })
        markdown += '\n'
      }

      if (details.requestBody) {
        markdown += '**Request Body:**\n\n'
        markdown += '```json\n'
        markdown += JSON.stringify(details.requestBody.content?.['application/json']?.schema, null, 2)
        markdown += '\n```\n\n'
      }

      if (details.responses) {
        markdown += '**Responses:**\n\n'
        for (const [code, response] of Object.entries(details.responses)) {
          markdown += `- **${code}:** ${response.description || ''}\n`
        }
        markdown += '\n'
      }

      markdown += '---\n\n'
    }
  }

  return markdown
}

const outputDir = path.join(process.cwd(), 'docs')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// Export Markdown
const markdownPath = path.join(outputDir, 'API_DOCUMENTATION.md')
const markdown = generateMarkdown(swaggerSpec as OpenAPISpec)
fs.writeFileSync(markdownPath, markdown)
console.log(`API documentation exported to: ${markdownPath}`)

// Export JSON
const jsonPath = path.join(outputDir, 'api-spec.json')
fs.writeFileSync(jsonPath, JSON.stringify(swaggerSpec, null, 2))
console.log(`API specification exported to: ${jsonPath}`)
