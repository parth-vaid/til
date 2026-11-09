import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { router } from './routes';

const app = express();
const PORT = 3000;

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
