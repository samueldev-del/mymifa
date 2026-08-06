const path = require('path');
const crypto = require('crypto');
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const multerS3 = require('multer-s3');

const BUCKET = process.env.AWS_S3_BUCKET_NAME;
const DUREE_URL_SIGNEE_S = 15 * 60; // 15 minutes

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

/**
 * Uploads privés : pas d'ACL public-read. Les documents (CV, lettres) ne
 * doivent pas être lisibles par quiconque devine l'URL — l'accès passe par des
 * URLs signées à durée limitée, générées après authentification.
 */
const construireUpload = (prefixe) =>
    multer({
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
        fileFilter: (req, file, cb) => {
            const extensions = ['.pdf', '.doc', '.docx'];
            if (!extensions.includes(path.extname(file.originalname).toLowerCase())) {
                return cb(new Error('Format de fichier non supporté (PDF, DOC, DOCX uniquement).'));
            }
            return cb(null, true);
        },
        storage: multerS3({
            s3,
            bucket: BUCKET,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
            key: (req, file, cb) => {
                const extension = path.extname(file.originalname);
                const base = path
                    .basename(file.originalname, extension)
                    .normalize('NFKD')
                    .replace(/[^\w.-]+/g, '-')
                    .slice(0, 60);
                const unique = crypto.randomBytes(8).toString('hex');
                cb(null, `${prefixe}/${Date.now()}-${unique}-${base}${extension}`);
            },
        }),
    });

/** Retrouve la clé S3 depuis une URL historique (documents créés avant cle_s3). */
const cleDepuisUrl = (url) => {
    try {
        return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    } catch {
        return null;
    }
};

/** URL de téléchargement temporaire. Retourne null si la clé est introuvable. */
const genererUrlSignee = async (cle, nomFichier) => {
    if (!cle) return null;

    return getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: BUCKET,
            Key: cle,
            ...(nomFichier
                ? { ResponseContentDisposition: `inline; filename="${nomFichier.replace(/"/g, '')}"` }
                : {}),
        }),
        { expiresIn: DUREE_URL_SIGNEE_S }
    );
};

/** Récupère le contenu binaire d'un objet (utilisé par l'analyse ATS). */
const telechargerObjet = async (cle) => {
    const reponse = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: cle }));
    return Buffer.from(await reponse.Body.transformToByteArray());
};

const supprimerObjet = async (cle) => {
    if (!cle) return;
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: cle }));
};

module.exports = {
    s3,
    construireUpload,
    genererUrlSignee,
    telechargerObjet,
    supprimerObjet,
    cleDepuisUrl,
    DUREE_URL_SIGNEE_S,
};
