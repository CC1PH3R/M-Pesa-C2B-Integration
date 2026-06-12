import path from 'path';
import { Express, Request, Response, NextFunction } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import mpesaConfig from './mpesa';

const API_BASE_PATH = '/api/ganji';

function buildApiDescription(): string {
  const lines = [
    'REST API for testing Safaricom Daraja C2B (Customer-to-Business) and STK Push (Lipa Na M-Pesa) integrations.',
    '',
    '**Try it out** sends requests to the server selected in the dropdown above (defaults to this deployment).',
    'Safaricom invokes the callback endpoints directly; use the paths below when registering URLs or simulating webhooks.',
  ];

  if (mpesaConfig.appBaseURL) {
    const { confirmation, stkCallback } = mpesaConfig.getCallbackURLs();
    lines.push(
      '',
      '**Live callback URLs** (from `APP_BASE_URL`):',
      `- C2B confirmation: \`${confirmation}\``,
      `- STK Push callback: \`${stkCallback}\``,
    );
  }

  return lines.join('\n');
}

function resolveRequestBaseUrl(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0]?.trim() ?? req.protocol;
  const host = req.get('x-forwarded-host') ?? req.get('host');

  if (!host) {
    return mpesaConfig.appBaseURL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  }

  return `${protocol}://${host}`;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

interface OpenApiServer {
  url: string;
  description?: string;
}

function buildServers(currentBaseUrl: string): OpenApiServer[] {
  const servers: OpenApiServer[] = [
    {
      url: currentBaseUrl,
      description: 'This deployment (use for Try it out)',
    },
  ];

  const configuredBase = mpesaConfig.appBaseURL
    ? normalizeBaseUrl(mpesaConfig.appBaseURL)
    : undefined;

  if (configuredBase && configuredBase !== currentBaseUrl) {
    servers.push({
      url: configuredBase,
      description: 'Configured APP_BASE_URL (public callbacks)',
    });
  }

  const localBase = `http://localhost:${process.env.PORT ?? 3000}`;
  if (currentBaseUrl !== localBase && configuredBase !== localBase) {
    servers.push({
      url: localBase,
      description: 'Local development',
    });
  }

  return servers;
}

const swaggerDefinition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'M-Pesa C2B & STK Push API',
    version: '1.0.0',
    description: buildApiDescription(),
    contact: {
      name: 'CC1PH3R',
      url: 'https://github.com/CC1PH3R/M-Pesa-C2B-Integration',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  tags: [
    { name: 'General', description: 'API discovery and metadata' },
    { name: 'Health', description: 'Service health and authentication checks' },
    { name: 'C2B', description: 'Customer-to-Business paybill/till payments' },
    { name: 'STK Push', description: 'Lipa Na M-Pesa (M-Pesa Express) payments' },
  ],
  components: {
    schemas: {
      ApiSuccess: {
        type: 'object',
        required: ['success'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
        },
      },
      ApiError: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
          mpesaError: { type: 'object', additionalProperties: true },
          hint: { type: 'string' },
        },
      },
      MpesaAcknowledgement: {
        type: 'object',
        description: 'Standard acknowledgement payload expected by Safaricom callbacks',
        required: ['ResultCode', 'ResultDesc'],
        properties: {
          ResultCode: { type: 'integer', example: 0 },
          ResultDesc: { type: 'string', example: 'Success' },
        },
      },
      HealthResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'M-Pesa C2B API is running' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      TokenInfo: {
        type: 'object',
        properties: {
          length: { type: 'integer', example: 280 },
          prefix: { type: 'string', example: 'eyJhbGciOiJSUzI1NiI...' },
        },
      },
      TestAuthResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Authentication successful' },
              tokenInfo: { $ref: '#/components/schemas/TokenInfo' },
            },
          },
        ],
      },
      RootResponse: {
        type: 'object',
        required: ['success', 'message', 'version', 'endpoints'],
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'M-Pesa C2B Test API' },
          version: { type: 'string', example: '1.0.0' },
          endpoints: {
            type: 'object',
            additionalProperties: { type: 'string' },
            example: {
              health: 'GET /api/ganji/health',
              register: 'POST /api/ganji/register',
            },
          },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          transactionType: { type: 'string', example: 'Pay Bill' },
          transID: { type: 'string', example: 'OEI2AK4Q16' },
          transTime: { type: 'string', example: '20240611120000' },
          transAmount: { type: 'string', example: '100.00' },
          businessShortCode: { type: 'string', example: '174379' },
          billRefNumber: { type: 'string', nullable: true, example: 'INV-001' },
          invoiceNumber: { type: 'string', nullable: true },
          msisdn: { type: 'string', example: '254712345678' },
          firstName: { type: 'string', nullable: true },
          middleName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          orgAccountBalance: { type: 'string', nullable: true },
          rawCallback: { type: 'object', additionalProperties: true },
          processed: { type: 'boolean' },
          processingError: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TransactionListResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              count: { type: 'integer', example: 10 },
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/Transaction' },
              },
            },
          },
        ],
      },
      TransactionResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/Transaction' },
            },
          },
        ],
      },
      C2BCallbackPayload: {
        type: 'object',
        description: 'Payload sent by Safaricom to the C2B confirmation URL',
        required: ['TransactionType', 'TransID', 'TransTime', 'TransAmount', 'BusinessShortCode', 'MSISDN'],
        properties: {
          TransactionType: { type: 'string', example: 'Pay Bill' },
          TransID: { type: 'string', example: 'OEI2AK4Q16' },
          TransTime: { type: 'string', example: '20240611120000' },
          TransAmount: { type: 'string', example: '100.00' },
          BusinessShortCode: { type: 'string', example: '174379' },
          BillRefNumber: { type: 'string', example: 'INV-001' },
          InvoiceNumber: { type: 'string', example: '' },
          OrgAccountBalance: { type: 'string', example: '49197.00' },
          ThirdPartyTransID: { type: 'string' },
          MSISDN: { type: 'string', example: '254712345678' },
          FirstName: { type: 'string', example: 'John' },
          MiddleName: { type: 'string', example: '' },
          LastName: { type: 'string', example: 'Doe' },
        },
      },
      SimulateC2BRequest: {
        type: 'object',
        required: ['amount', 'msisdn'],
        properties: {
          amount: {
            type: 'string',
            description: 'Payment amount in KES',
            example: '100',
          },
          msisdn: {
            type: 'string',
            description: 'Customer phone number (254XXXXXXXXX)',
            example: '254712345678',
          },
          billRefNumber: {
            type: 'string',
            description: 'Account reference / bill number',
            example: 'TestAccount',
            default: 'TestAccount',
          },
        },
      },
      StkPushRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          merchantRequestID: { type: 'string' },
          checkoutRequestID: { type: 'string' },
          phoneNumber: { type: 'string', example: '254712345678' },
          amount: { type: 'string', example: '100.00' },
          accountRef: { type: 'string', example: 'INV-001' },
          description: { type: 'string', example: 'Payment' },
          responseCode: { type: 'string', example: '0' },
          responseDescription: { type: 'string', example: 'Success. Request accepted for processing' },
          customerMessage: { type: 'string', example: 'Success. Request accepted for processing' },
          resultCode: { type: 'integer', nullable: true, example: 0 },
          resultDesc: { type: 'string', nullable: true },
          mpesaReceiptNumber: { type: 'string', nullable: true },
          transactionDate: { type: 'string', nullable: true },
          callbackPhoneNumber: { type: 'string', nullable: true },
          rawCallback: { type: 'object', nullable: true, additionalProperties: true },
          callbackReceivedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      StkPushInitiateRequest: {
        type: 'object',
        required: ['phoneNumber', 'amount', 'accountRef'],
        properties: {
          phoneNumber: {
            type: 'string',
            pattern: '^254(7|1)\\d{8}$',
            description: 'Customer phone in international format (2547XXXXXXXX or 2541XXXXXXXX)',
            example: '254712345678',
          },
          amount: {
            type: 'integer',
            minimum: 1,
            description: 'Whole number amount in KES',
            example: 100,
          },
          accountRef: {
            type: 'string',
            maxLength: 12,
            description: 'Account reference shown on the STK prompt',
            example: 'INV-001',
          },
          description: {
            type: 'string',
            maxLength: 13,
            description: 'Transaction description shown on the STK prompt',
            example: 'Payment',
            default: 'Payment',
          },
        },
      },
      StkPushInitiateData: {
        type: 'object',
        properties: {
          MerchantRequestID: { type: 'string' },
          CheckoutRequestID: { type: 'string' },
          ResponseCode: { type: 'string', example: '0' },
          ResponseDescription: { type: 'string' },
          CustomerMessage: { type: 'string' },
        },
      },
      StkQueryRequest: {
        type: 'object',
        required: ['checkoutRequestID'],
        properties: {
          checkoutRequestID: {
            type: 'string',
            description: 'CheckoutRequestID returned from STK Push initiation',
            example: 'ws_CO_191220191020363925',
          },
        },
      },
      StkCallbackPayload: {
        type: 'object',
        description: 'Async callback payload sent by Safaricom after STK Push completes',
        properties: {
          Body: {
            type: 'object',
            properties: {
              stkCallback: {
                type: 'object',
                properties: {
                  MerchantRequestID: { type: 'string' },
                  CheckoutRequestID: { type: 'string' },
                  ResultCode: { type: 'integer', example: 0 },
                  ResultDesc: { type: 'string', example: 'The service request is processed successfully.' },
                  CallbackMetadata: {
                    type: 'object',
                    properties: {
                      Item: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            Name: { type: 'string' },
                            Value: {},
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      DarajaResponse: {
        type: 'object',
        additionalProperties: true,
        description: 'Raw response object from the Safaricom Daraja API',
      },
      DataEnvelope: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/DarajaResponse' },
            },
          },
        ],
      },
      StkRequestListResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              count: { type: 'integer', example: 5 },
              data: {
                type: 'array',
                items: { $ref: '#/components/schemas/StkPushRequest' },
              },
            },
          },
        ],
      },
      StkRequestResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiSuccess' },
          {
            type: 'object',
            properties: {
              data: { $ref: '#/components/schemas/StkPushRequest' },
            },
          },
        ],
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
      InternalError: {
        description: 'Server or upstream Daraja API error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
          },
        },
      },
    },
    parameters: {
      LimitQuery: {
        name: 'limit',
        in: 'query',
        description: 'Maximum number of records to return',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      TransIDPath: {
        name: 'transID',
        in: 'path',
        required: true,
        description: 'M-Pesa transaction ID',
        schema: { type: 'string', example: 'OEI2AK4Q16' },
      },
      CheckoutRequestIDPath: {
        name: 'checkoutRequestID',
        in: 'path',
        required: true,
        description: 'STK Push CheckoutRequestID from initiation response',
        schema: { type: 'string', example: 'ws_CO_191220191020363925' },
      },
    },
  },
};

const swaggerOptions: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../server.ts'),
    path.join(__dirname, '../server.js'),
  ],
};

const baseSwaggerSpec = swaggerJsdoc(swaggerOptions);

export function buildSwaggerSpec(req?: Request): Record<string, unknown> {
  const currentBaseUrl = normalizeBaseUrl(
    req ? resolveRequestBaseUrl(req) : mpesaConfig.appBaseURL ?? `http://localhost:${process.env.PORT ?? 3000}`,
  );

  return {
    ...baseSwaggerSpec,
    servers: buildServers(currentBaseUrl),
  };
}

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'M-Pesa C2B API — Swagger',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    // Default to the deployment the docs were opened from, not localhost.
    url: '/api-docs.json',
  },
};

export function setupSwagger(app: Express): void {
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(buildSwaggerSpec(req));
  });

  app.use(
    '/api-docs',
    swaggerUi.serve,
    (req: Request, res: Response, next: NextFunction) => {
      swaggerUi.setup(buildSwaggerSpec(req), swaggerUiOptions)(req, res, next);
    },
  );
}

export { API_BASE_PATH };
