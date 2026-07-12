/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Anliegen-Anhänge (bis 3 Dateien à 4 MB, plus Formular-Overhead)
      bodySizeLimit: "18mb",
    },
  },
};
export default nextConfig;
