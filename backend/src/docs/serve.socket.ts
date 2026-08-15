/**
 * Serves the realtime reference and the raw AsyncAPI document.
 *
 * - '/v1/docs/socket' renders the document with the AsyncAPI web component.
 * - '/v1/docs/socket/asyncapi.json' is the document itself, for code
 *   generators and for the page above, which fetches it over HTTP.
 *
 * The renderer is loaded from a CDN instead of being installed: the component
 * is a browser bundle shipping its own React copy, it would weigh more than
 * every backend dependency together, and nothing on the server needs it. The
 * page falls back to a link to the raw document when the CDN is unreachable.
 *
 * There is no read-only and interactive split here, unlike the REST reference:
 * the page cannot send anything, it only reads the document.
 */

import express, { Router } from 'express'
import { asyncapiSpec } from './asyncapi.js'

const DOCUMENT_URL = '/v1/docs/socket/asyncapi.json'
const COMPONENT_VERSION = '2.6.4'
const COMPONENT_BASE = 'https://unpkg.com/@asyncapi/react-component@' + COMPONENT_VERSION

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyQuizz Realtime Reference</title>
    <link rel="stylesheet" href="${COMPONENT_BASE}/styles/default.min.css" />
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
      #fallback { padding: 24px; font-size: 14px; }
    </style>
  </head>
  <body>
    <div id="asyncapi">
      <p id="fallback">
        Loading the realtime reference. If nothing shows up, read the raw document at
        <a href="${DOCUMENT_URL}">${DOCUMENT_URL}</a>.
      </p>
    </div>
    <script src="${COMPONENT_BASE}/browser/standalone/index.js"></script>
    <script>
      AsyncApiStandalone.render(
        {
          schema: { url: '${DOCUMENT_URL}', options: { method: 'GET', mode: 'cors' } },
          config: { show: { sidebar: true, errors: true } }
        },
        document.getElementById('asyncapi')
      )
    </script>
  </body>
</html>
`

const router = express.Router()

// Registered before the page so the document keeps its own URL.
router.get('/asyncapi.json', (req, res) => {
  res.json(asyncapiSpec)
})

router.get('/', (req, res) => {
  res.type('html').send(page)
})

export const socketDocsRouter: Router = router
