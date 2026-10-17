/**
 * Configuracion PM2 para el Sistema de Beneficios Colegiales.
 * Uso:  pm2 start ecosystem.config.js && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'cip-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'cip-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // Destino del rewrite /api/* (proxy interno de Next hacia el backend)
        INTERNAL_API_URL: 'http://localhost:3001',
      },
    },
  ],
};
