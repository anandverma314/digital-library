import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true });

  // Optional: serve the built React app from the same server (one free deployment).
  const dist = process.env.FRONTEND_DIST ? resolve(process.cwd(), process.env.FRONTEND_DIST) : null;
  if (dist && existsSync(join(dist, 'index.html'))) {
    app.useStaticAssets(dist, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(join(dist, 'index.html'));
    });
    logger.log(`Serving frontend from ${dist}`);
  }

  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api`);
}

void bootstrap();
