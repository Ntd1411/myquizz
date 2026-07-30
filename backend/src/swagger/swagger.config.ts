import swaggerJsdoc from 'swagger-jsdoc'

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
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://myquizz.dpdns.org/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
          description: 'Authentication sử dụng HTTP-only cookie. Token được tự động gửi sau khi đăng nhập thành công.'
        }
      }
    }
  },
  apis: ['./dist/modules/**/*.route.js', './dist/swagger/*.js']
}

export const swaggerSpec = swaggerJsdoc(options)
