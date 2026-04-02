import express, { type Router } from 'express';

export const uiRouter: Router = express.Router();

uiRouter.get('/', async (_request, response) => {
  response.sendFile('index.html', { root: 'public' });
});
