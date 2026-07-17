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
        url: 'http://localhost:3000',
        description: 'Development server'
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
  apis: ['./src/modules/**/*.ts', './src/modules/**/*.js']
}

export const swaggerSpec = swaggerJsdoc(options)
