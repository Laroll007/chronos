module.exports = {
  apps: [
    {
      name: 'chronos',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/var/www/chronos',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
