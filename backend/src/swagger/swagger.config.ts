import swaggerJsdoc from 'swagger-jsdoc'
import { env } from '../infrastructure/config/envconfig.js'

// Routes are mounted under /v1, so every documented path is relative to it.
const servers = [
  {
    url: `http://localhost:${env.PORT}/v1`,
    description: 'Development server'
  }
]

if (env.API_PUBLIC_URL) {
  servers.push({
    url: `${env.API_PUBLIC_URL}/v1`,
    description: 'Production server'
  })
}

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MyQuizz API',
      version: '1.0.0',
      description: 'API documentation cho ứng dụng MyQuizz - Realtime Quiz Game',
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
          description: 'Authentication sử dụng HTTP-only cookie. Token được tự động gửi sau khi đăng nhập thành công.'
        }
      }
    }
  },
  apis: ['./dist/modules/**/*.route.js', './dist/swagger/*.js']
}

export const swaggerSpec = swaggerJsdoc(options)
