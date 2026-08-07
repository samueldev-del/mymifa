require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

// Nécessaire derrière un reverse proxy pour que req.ip soit l'IP cliente
// réelle (limitation de débit sur /auth/login).
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
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

// Fail-fast : sans ADMIN_PASSWORD, l'API serait injoignable après login.
if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD est absent du .env — la connexion sera impossible.');
}

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
