/**
 * Déclenche la synchronisation des emails sur l'API MyMifa.
 *
 * Remplace le cron GitHub Actions, dont l'événement `schedule` est traité
 * en « meilleur effort » : mesuré à 19 exécutions par jour au lieu des 96
 * configurées, avec des écarts allant jusqu'à 2h43.
 *
 * Le secret est lu depuis SSM Parameter Store au démarrage plutôt qu'injecté
 * en variable d'environnement : il n'apparaît ainsi ni dans le code, ni dans
 * le state Terraform, ni dans la configuration de la fonction.
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

const API_URL = process.env.API_URL;
const SECRET_PARAM = process.env.SECRET_PARAM;

// Mis en cache entre deux invocations : Lambda réutilise le contexte
// d'exécution, ce qui évite un appel SSM à chaque déclenchement.
let secretCache = null;

const lireSecret = async () => {
  if (secretCache) return secretCache;

  const reponse = await ssm.send(
    new GetParameterCommand({ Name: SECRET_PARAM, WithDecryption: true }),
  );

  secretCache = reponse.Parameter.Value;
  return secretCache;
};

export const handler = async () => {
  const secret = await lireSecret();

  const reponse = await fetch(`${API_URL}/api/emails/sync`, {
    method: 'POST',
    headers: {
      'x-webhook-secret': secret,
      'Content-Type': 'application/json',
    },
    // La synchronisation lit une boîte IMAP : elle peut être lente.
    signal: AbortSignal.timeout(120_000),
  });

  const corps = await reponse.text();

  if (!reponse.ok) {
    // Une exception fait échouer l'invocation, ce qui alimente la métrique
    // CloudWatch `Errors` — sur laquelle on posera une alarme à l'étape 3.
    throw new Error(`Synchronisation échouée (HTTP ${reponse.status}) : ${corps}`);
  }

  console.log(`Synchronisation réussie (HTTP ${reponse.status})`);
  return { statusCode: reponse.status, body: corps };
};