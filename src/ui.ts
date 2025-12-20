import type { Router } from 'ultimate-express';
import express from 'ultimate-express';

export const uiRouter: Router = express.Router();

uiRouter.get('/', async (_request, response) => {
  response.sendFile('index.html', { root: 'public' });
});
