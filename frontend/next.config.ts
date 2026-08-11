/** @type {import('next').NextConfig} */
const nextConfig = {
  // Adresses depuis lesquelles le téléphone atteint le serveur de dev sur le
  // réseau local. L'IP change avec le réseau (box, partage de connexion) :
  // en ajouter une ici puis relancer `npm run dev`.
  allowedDevOrigins: ['192.168.178.63', '192.168.0.207'],
};

export default nextConfig;
