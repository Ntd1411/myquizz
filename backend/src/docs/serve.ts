/**
 * Serves the API reference UI (Scalar) and the raw OpenAPI document.
 *
 * The JSON route is registered before the UI because the UI is mounted on '/'
 * and would otherwise swallow every request under the docs prefix.
 *
 * Reading experience follows the Resend reference: operations in the sidebar,
 * every group open, responses and schema properties expanded, and a Node.js
 * snippet in the code panel. Colours come from the Kepler-11e theme, so the
 * custom CSS only touches typography and radii.
 */

import express, { Router } from 'express'
import { apiReference } from '@scalar/express-api-reference'
import { openapiSpec } from './openapi.js'

const customCss = `
:root {
  --scalar-radius: 6px;
  --scalar-radius-lg: 8px;
  --scalar-radius-xl: 10px;
  --scalar-heading-1: 26px;
  --scalar-heading-2: 19px;
  --scalar-heading-3: 16px;
  --scalar-bold: 550;
}
`

export const docsRouter: Router = express.Router()

docsRouter.get('/openapi.json', (req, res) => {
  res.json(openapiSpec)
})

docsRouter.use(
  '/',
  apiReference({
    url: '/v1/docs/openapi.json',
    theme: 'kepler',
    layout: 'modern',
    customCss,
    // Browser tab title, independent from info.title in the document.
    metaData: {
      title: 'MyQuizz API Reference',
      description:
        'REST reference for the MyQuizz backend: accounts, quizzes, game sessions and uploads.'
    },
    // Every group stays open so the sidebar reads as one flat list of
    // operations, the way the Resend reference presents its resources.
    defaultOpenAllTags: true,
    expandAllResponses: true,
    // Models stay visible, and nested objects are unfolded by default so the
    // child attributes of a quiz, a session or an envelope are readable
    // without clicking through every level.
    hideModels: false,
    expandAllModelSections: true,
    expandAllSchemaProperties: true,
    orderRequiredPropertiesFirst: true,
    orderSchemaPropertiesBy: 'preserve',
    // No MCP server is published for this API. agent covers the newer builds,
    // mcp.disabled the ones that still render the Generate MCP button in the
    // sidebar footer; both are needed because the flag moved between releases.
    agent: { disabled: true },
    mcp: { name: 'MyQuizz API', url: '/v1/docs/openapi.json', disabled: true },
    // The frontend is the main consumer, so the snippet panel opens on Node.js
    // and only keeps the clients somebody would realistically copy.
    defaultHttpClient: { targetKey: 'node', clientKey: 'fetch' },
    hiddenClients: {
      c: true,
      clojure: true,
      csharp: true,
      dart: true,
      fsharp: true,
      http: true,
      java: true,
      kotlin: true,
      objc: true,
      ocaml: true,
      php: true,
      powershell: true,
      r: true,
      ruby: true,
      swift: true
    },
    documentDownloadType: 'json'
  })
)
