import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';


const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Choweazy API Docs',
      version: '1.0.0',
      description: 'API documentation for ChowEazy food delivery platform"',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // This looks for files containing annotations in your routes folder
  apis: ['./src/auth/auth.route.ts', './src/restuarant/restaurant.route.ts',  './src/order/order.route.ts','./src/rider/rider.route.ts', './src/vendor/vendor.route.ts', './src/payment/payment.route.ts'], 
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log('📄 Swagger Docs available at http://localhost:4000/api-docs');
};

