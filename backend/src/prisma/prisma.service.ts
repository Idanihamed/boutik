import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Nombre de tentatives et délai entre chaque — observé en développement local (voir README) :
// PostgreSQL peut ne pas encore accepter de connexions au moment précis où `nest start --watch`
// relance l'application (démarrage du service PostgreSQL encore en cours après un redémarrage
// de la machine, par exemple). Sans ces tentatives, `$connect()` échouait une seule fois avec
// P1001 et faisait planter tout le processus Node — qui ne redémarre alors JAMAIS tout seul
// (`nest --watch` ne relance l'appli que sur un changement de fichier, pas après un crash),
// obligeant à relancer manuellement à chaque fois. 10 tentatives × 3s couvre largement le délai
// de démarrage d'un service PostgreSQL local sans faire attendre indéfiniment un vrai problème
// de configuration (mauvaise URL, base inexistante...), qui continuera de faire échouer l'appli
// avec une erreur claire une fois les tentatives épuisées.
const CONNECT_MAX_ATTEMPTS = 10;
const CONNECT_RETRY_DELAY_MS = 3000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        if (attempt === CONNECT_MAX_ATTEMPTS) throw err;
        this.logger.warn(
          `Connexion à la base de données échouée (tentative ${attempt}/${CONNECT_MAX_ATTEMPTS}), ` +
            `nouvel essai dans ${CONNECT_RETRY_DELAY_MS / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
