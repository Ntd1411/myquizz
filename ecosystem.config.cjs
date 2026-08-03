module.exports = {
  apps: [
    {
      name: 'myquizz-api',
      cwd: '/var/www/myquizz/backend',
      script: 'dist/app.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
      error_file: '/var/log/myquizz/api-error.log',
      out_file: '/var/log/myquizz/api-out.log',
      merge_logs: true,
      time: true
    }

    // Enable once backend/src/jobs/hot-score.ts exists (homepage phase 1).
    // Recomputes the decayed hot_score column every 30 minutes.
    // {
    //   name: 'myquizz-hotscore',
    //   cwd: '/var/www/myquizz/backend',
    //   script: 'dist/jobs/hot-score.js',
    //   autorestart: false,
    //   cron_restart: '*/30 * * * *',
    //   env: { NODE_ENV: 'production' },
    //   error_file: '/var/log/myquizz/hotscore-error.log',
    //   out_file: '/var/log/myquizz/hotscore-out.log',
    //   time: true
    // }
  ]
}
