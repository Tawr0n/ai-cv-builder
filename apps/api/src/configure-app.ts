import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi/openapi-document.js';

/** App-wide HTTP setup shared by `main.ts` and the tests. */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  app.use(cookieParser());

  const document = buildOpenApiDocument();
  app.use('/api/docs/openapi.json', (_req: Request, res: Response) => {
    res.json(document);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document));
}
