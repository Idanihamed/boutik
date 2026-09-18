import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Échec rapide et explicite si les secrets JWT ne sont pas configurés, plutôt qu'un
  // plantage confus (et un 500 générique) au tout premier login/refresh — jsonwebtoken
  // refuse de signer un token avec une clé vide/`undefined`.
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (!config.get<string>(key)) {
      throw new Error(`Variable d'environnement ${key} manquante ou vide. Voir backend/.env.example.`);
    }
  }

  configureApp(app, config);

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API Boutik démarrée sur http://localhost:${port}/api`);
}

bootstrap();
