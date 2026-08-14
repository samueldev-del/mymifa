const { Pool } = require('pg');
require('dotenv').config();

const EN_SERVERLESS = process.env.VERCEL === '1';
/**
 * Neon (et la plupart des bases managées) exigent TLS. Un PostgreSQL local,
 * lui, n'a pas de certificat et refuse la négociation — d'où l'échec avec
 * « The server does not support SSL connections ».
 *
 * On active donc TLS uniquement quand la chaîne de connexion le demande.
 * `rejectUnauthorized: false` accepte le certificat de Neon sans en vérifier
 * la chaîne de confiance ; à durcir le jour où on maîtrisera l'autorité de
 * certification (RDS fournit un bundle CA téléchargeable).
 */
const SSL_REQUIS = /sslmode=require/.test(process.env.DATABASE_URL || '');

/**
 * Pool PostgreSQL vers Neon.
 *
 * En serverless, chaque instance de fonction ouvre son propre pool : un `max`
 * élevé multiplié par le nombre d'instances épuiserait les connexions Neon.
 * La chaîne DATABASE_URL doit viser l'endpoint « -pooler » de Neon, qui place
 * un PgBouncer devant la base.
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: EN_SERVERLESS ? 1 : 10,
    idleTimeoutMillis: EN_SERVERLESS ? 10_000 : 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: SSL_REQUIS ? { rejectUnauthorized: false } : false,
});

// Une erreur sur un client inactif ne doit pas faire tomber le processus.
pool.on('error', (error) => {
    console.error('Erreur inattendue du pool PostgreSQL:', error.message);
});

if (EN_SERVERLESS && !/-pooler\./.test(process.env.DATABASE_URL || '')) {
    console.warn(
        'DATABASE_URL ne vise pas l\'endpoint -pooler de Neon : risque d\'épuisement des connexions en serverless.'
    );
}

module.exports = pool;
