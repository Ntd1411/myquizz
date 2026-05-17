import express from 'express'
import { config } from './infrastructure/config/config.js'
import { pool } from './infrastructure/database/connection.js'
import { runMigrations } from './infrastructure/database/migrate.js'
const app = express()

const port = config.server.port

await runMigrations()

app.get('/', (req, res) => {
  res.send("Hello, world")
})

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})