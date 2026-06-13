import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const publicPath = join(process.cwd(), 'public');
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (/^\/admin(?:\/.*)?$/.test(request.path)) {
      response.sendFile(join(publicPath, 'admin', 'index.html'));
      return;
    }
    next();
  });
  app.useStaticAssets(publicPath);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({ origin: '*', credentials: true });
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3202;
  await app.listen(port);

  console.log(`Supplier Microservice running on port ${port}`);
}

bootstrap();
