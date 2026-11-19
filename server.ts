import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { NexusControlPlane } from './src/nexus/controlPlane';
import type { RouteDryRunRequest } from './src/nexus/governance';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createNexusApp() {
  const app = express();
  const controlPlane = new NexusControlPlane();

  app.use(express.json({ limit: '512kb' }));

  app.get('/api/nexus/status', (_req, res) => {
    res.json(controlPlane.getStatus());
  });

  app.get('/api/nexus/providers', (_req, res) => {
    res.json(controlPlane.listProviders());
  });

  app.post('/api/nexus/route-dry-run', (req, res) => {
    const body = req.body as Partial<RouteDryRunRequest> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }
    if (!Array.isArray(body.required_capabilities) || body.required_capabilities.length === 0) {
      res.status(400).json({ error: 'required_capabilities must be a non-empty array.' });
      return;
    }
    if (!Array.isArray(body.required_modalities) || body.required_modalities.length === 0) {
      res.status(400).json({ error: 'required_modalities must be a non-empty array.' });
      return;
    }

    const dryRunReq: RouteDryRunRequest = {
      division_id: typeof body.division_id === 'string' ? body.division_id : 'research',
      agent_id: typeof body.agent_id === 'string' ? body.agent_id : 'nx_custom_agent',
      production_track:
        body.production_track === 'creative' ? 'creative' : 'general_automation',
      objective:
        typeof body.objective === 'string'
          ? body.objective
          : 'Dry-run NACS 6-stage routing verification',
      required_capabilities: body.required_capabilities,
      required_modalities: body.required_modalities,
      required_scopes: Array.isArray(body.required_scopes)
        ? body.required_scopes
        : ['model.invoke'],
      max_cost_usd:
        typeof body.max_cost_usd === 'number' && Number.isFinite(body.max_cost_usd)
          ? Math.max(0.01, body.max_cost_usd)
          : 1.0,
      data_sensitivity:
        body.data_sensitivity === 'public' ||
        body.data_sensitivity === 'internal' ||
        body.data_sensitivity === 'confidential' ||
        body.data_sensitivity === 'restricted'
          ? body.data_sensitivity
          : 'internal',
      require_zero_data_retention: Boolean(body.require_zero_data_retention),
      pii_present: Boolean(body.pii_present),
      human_approval_required: Boolean(body.human_approval_required),
      granted_scopes: Array.isArray(body.granted_scopes)
        ? body.granted_scopes
        : ['model.invoke'],
      human_approval_verified: Boolean(body.human_approval_verified),
      allow_preview_models: Boolean(body.allow_preview_models),
    };

    const result = controlPlane.evaluateRouteDryRun(dryRunReq);
    res.json(result);
  });

  app.post('/api/nexus/security/scan', (req, res) => {
    const payload = req.body?.payload !== undefined ? req.body.payload : req.body;
    if (payload === undefined) {
      res.status(400).json({ error: 'Missing payload to scan.' });
      return;
    }
    res.json(controlPlane.scanPayloadSecurity(payload));
  });

  app.post('/api/nexus/contracts/validate', (req, res) => {
    const payload = req.body?.contract !== undefined ? req.body.contract : req.body;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Contract payload must be a JSON object.' });
      return;
    }
    res.json(controlPlane.validateWorkflowContractSchema(payload));
  });

  return app;
}

async function startServer() {
  const app = createNexusApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT ?? 3000);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`NEXUS APEX Control Plane listening on http://0.0.0.0:${port}`);
  });
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start NEXUS APEX server:', err);
    process.exit(1);
  });
}
