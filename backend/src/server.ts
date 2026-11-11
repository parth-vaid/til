import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { router } from './routes';

const app = express();
const PORT = 3000;
// The frontend is served from a different port, so to the browser it's a
// different "origin". This is the only origin we allow to call the API.
const FRONTEND_ORIGIN = 'http://localhost:5173';

// CORS middleware: tells the browser the frontend may read our responses.
// Placed first so every response carries these headers, errors included.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Before a POST/PUT with JSON, or a DELETE, the browser sends an OPTIONS
  // "preflight" request to ask permission. The headers above are the answer,
  // so reply "204 No Content" and don't run any route.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next(); // not a preflight: carry on to the next middleware / route
});

// Middleware: runs before every route. Turns the JSON text in a request body
// into a JS object at req.body.
app.use(express.json());

// Quick "is the server alive?" check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// All the /transactions and /summary routes from routes.ts
app.use(router);

// Nothing above matched → 404 (as JSON, so API clients can read it)
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Error handler. Express recognises it because it takes 4 arguments.
// Any error thrown in a route ends up here instead of crashing the server.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // express.json() throws a SyntaxError when the body isn't valid JSON.
  // That's the client's mistake, so answer 400 instead of 500.
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  console.error(err); // full details for you, in the terminal
  res.status(500).json({ error: 'Something went wrong' });
});

// Start listening for requests
app.listen(PORT, () => {
  console.log(`Finance tracker API running at http://localhost:${PORT}`);
});
