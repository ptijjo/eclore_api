import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // onModuleDestroy (Prisma / Redis) aussi sur SIGTERM / SIGINT.
  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || 8000;
  // 0.0.0.0 : joignable depuis un téléphone sur le LAN (pas seulement localhost).
  await app.listen(port, '0.0.0.0');
  console.log(`Server is running on http://0.0.0.0:${port}`);
}
void bootstrap();
