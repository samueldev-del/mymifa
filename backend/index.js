require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const pool = require('./config/db');
const { sendError, sendSuccess } = require('./utils/http');
const requireAuth = require('./middlewares/auth');

const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const documentRoutes = require('./routes/documentRoutes');
const cvRoutes = require('./routes/cvRoutes');
const aiRoutes = require('./routes/aiRoutes');
const profilRoutes = require('./routes/profilRoutes');
const emailRoutes = require('./routes/emailRoutes');
const carriereRoutes = require('./routes/carriereRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Vercel définit VERCEL=1 ; utile pour distinguer serverless et exécution locale.
const EN_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

// --- Vérifications de configuration au démarrage -------------------------
// Mieux vaut un échec bruyant au boot qu'une faille silencieuse en ligne.
const manquantes = ['DATABASE_URL', 'ADMIN_PASSWORD'].filter((cle) => !process.env[cle]);
if (manquantes.length > 0) {
    console.error(`Variables d'environnement manquantes : ${manquantes.join(', ')}`);
    if (EN_PRODUCTION) throw new Error('Configuration incomplète : démarrage interrompu.');
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

if (EN_PRODUCTION && allowedOrigins.length === 0) {
    throw new Error(
        'FRONTEND_ORIGIN doit être défini en production : sans lui, toutes les origines seraient acceptées.'
    );
}

// Derrière le proxy Vercel : nécessaire pour que req.ip soit l'IP cliente
// réelle (limitation de débit sur /auth/login).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
    helmet({
        // L'API ne sert que du JSON : une CSP n'a rien à protéger ici, et
        // celle par défaut de helmet gênerait les réponses d'erreur.
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-site' },
    })
);

app.use(compression());

app.use(
    cors({
        origin: (origin, callback) => {
            // Requêtes sans origine : curl, sondes de monitoring, webhooks.
            if (!origin) return callback(null, true);
            if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: false,
        maxAge: 86400,
    })
);

app.use(express.json({ limit: '1mb' }));

// --- Routes publiques ---------------------------------------------------
// Healthcheck : ne doit pas exiger de session (sondes de monitoring).
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        return sendSuccess(res, 200, { time: result.rows[0].now }, 'API connectée à Neon');
    } catch (error) {
        return sendError(res, 500, 'HEALTHCHECK_ERROR', error.message);
    }
});

// Connexion + webhook email : authentifiés par leurs propres mécanismes
// (mot de passe admin / secret partagé).
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// --- Routes protégées ---------------------------------------------------
// Tout ce qui suit exige un jeton de session valide.
app.use('/api', requireAuth);

app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/profil', profilRoutes);

// Modules de gestion de carrière.
app.use('/api/dashboard', carriereRoutes.dashboard);
app.use('/api/formations', carriereRoutes.formations);
app.use('/api/contacts', carriereRoutes.contacts);
app.use('/api/relances', carriereRoutes.relances);
app.use('/api/interviews', carriereRoutes.interviews);

app.use((req, res) => sendError(res, 404, 'NOT_FOUND', 'Route introuvable.'));

app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
        return sendError(res, 403, 'CORS_FORBIDDEN', 'Origine non autorisée.');
    }

    if (err instanceof multer.MulterError) {
        const message =
            err.code === 'LIMIT_FILE_SIZE'
                ? 'Fichier trop volumineux (10 Mo maximum).'
                : 'Erreur lors du téléversement du fichier.';
        return sendError(res, 400, 'UPLOAD_ERROR', message);
    }

    // Rejet du fileFilter (format non supporté).
    if (err && /Format de fichier non supporté/.test(err.message)) {
        return sendError(res, 400, 'UPLOAD_INVALID_TYPE', err.message);
    }

    console.error('Erreur non gérée:', err);
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Erreur interne du serveur.');
});

// En serverless, Vercel invoque l'application exportée : ouvrir un port serait
// inutile. En local, on écoute normalement.
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Serveur démarré sur http://localhost:${port}`);
    });
}

module.exports = app;
