"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const options = {
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
    apis: ['./src/auth/auth.route.ts', './src/restuarant/restaurant.route.ts', './src/order/order.route.ts', './src/rider/rider.route.ts', './src/vendor/vendor.route.ts', './src/payment/payment.route.ts'],
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
const setupSwagger = (app) => {
    app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
    console.log('📄 Swagger Docs available at http://localhost:4000/api-docs');
};
exports.setupSwagger = setupSwagger;
//# sourceMappingURL=swagger.js.map