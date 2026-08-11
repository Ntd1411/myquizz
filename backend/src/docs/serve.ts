/**
 * Serves the API reference UI (Scalar) and the raw OpenAPI document.
 *
 * The same document is published twice, with a different level of interactivity:
 *
 * - '/v1/docs' is the public reference. The Test Request panel is hidden, so a
 *   reader can browse the endpoints but cannot fire live calls at the API from
 *   the docs page.
 * - '/v1/api-docs' is the internal one, kept behind HTTP basic auth in the
 *   reverse proxy, and keeps Test Request so the API can be exercised from the
 *   browser without any other client.
 *
 * Each reference exposes its own copy of the document instead of sharing one
 * URL: the UI fetches the spec over HTTP, and the internal page must not depend
 * on a path the proxy may restrict or rewrite differently.
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

type DocsRouterOptions = {
  // Mount path of this reference under /v1, used to build the document URL.
  basePath: string
  // Hides the Test Request panel, turning the page into a read-only reference.
  readOnly: boolean
  // Suffix appended to the browser tab title, to tell the two pages apart.
  titleSuffix: string
}

const createDocsRouter = ({ basePath, readOnly, titleSuffix }: DocsRouterOptions): Router => {
  const router = express.Router()
  const specUrl = `/v1/${basePath}/openapi.json`

  router.get('/openapi.json', (req, res) => {
    res.json(openapiSpec)
  })

  router.use(
    '/',
    apiReference({
      url: specUrl,
      theme: 'kepler',
      layout: 'modern',
      customCss,
      // Browser tab title, independent from info.title in the document.
      metaData: {
        title: `MyQuizz API Reference${titleSuffix}`,
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
      // Public page: no way to send a request from the reference. The internal
      // page keeps the panel, since it already sits behind basic auth.
      hideTestRequestButton: readOnly,
      // No MCP server is published for this API. agent covers the newer builds,
      // mcp.disabled the ones that still render the Generate MCP button in the
      // sidebar footer; both are needed because the flag moved between releases.
      agent: { disabled: true },
      mcp: { name: 'MyQuizz API', url: specUrl, disabled: true },
      // Drops the Open API Client entry from the sidebar footer. On the internal
      // page requests are meant to be sent from the Test Request panel of each
      // operation, not from the standalone client, which opens the whole
      // document in a separate app; on the public page nothing should send one.
      hideClientButton: true,
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

  return router
}

// Public, read-only reference.
export const docsRouter: Router = createDocsRouter({
  basePath: 'docs',
  readOnly: true,
  titleSuffix: ''
})

// Internal reference, protected by basic auth in the reverse proxy.
export const internalDocsRouter: Router = createDocsRouter({
  basePath: 'api-docs',
  readOnly: false,
  titleSuffix: ' (internal)'
})
