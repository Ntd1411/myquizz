import path from 'path'
import { fileURLToPath } from 'url'
import swaggerJsdoc from 'swagger-jsdoc'
import { env } from '../infrastructure/config/envconfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

// Routes are mounted under /v1, so every documented path is relative to it.
const servers = [
  {
    url: `http://localhost:${env.PORT}/v1`,
    description: 'Development server'
  }
]

if (env.API_PUBLIC_URL) {
  servers.push({
    url: `${env.API_PUBLIC_URL}`,
    description: 'Production server'
  })
}

// Scan the sources that are actually running: .ts under src in development,
// compiled .js under dist in production. Paths are resolved from this file
// rather than from the working directory, so the spec no longer depends on
// where the process was started from, and editing JSDoc in src takes effect
// immediately in dev without a build.
const isCompiled = currentDir.includes(`${path.sep}dist${path.sep}`)
const rootDir = path.resolve(currentDir, '..')
const extension = isCompiled ? 'js' : 'ts'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MyQuizz API',
      version: '1.0.0',
      description: 'API documentation for MyQuizz - realtime quiz game',
      contact: {
        name: 'API Support',
        email: 'support@myquizz.com'
      }
    },
    servers,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          // Must match the cookie name set in auth.controller.ts
          name: 'accessToken',
          description: 'Authentication uses an HTTP-only cookie sent automatically after a successful login.'
        }
      }
    }
  },
  apis: [
    path.join(rootDir, 'modules', '**', `*.route.${extension}`),
    path.join(rootDir, 'swagger', `*.${extension}`)
  ]
}

export const swaggerSpec = swaggerJsdoc(options)
