/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['tesseract.js'],
  },
}

module.exports = nextConfig
