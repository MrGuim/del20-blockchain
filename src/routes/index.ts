import { Router } from 'express';
import multer from 'multer';

import * as tokenController from '../controllers/token.controller';
import * as validations from '../validations';
import validate from '../middlewares/validate';

const upload = multer({ dest: './events/img' });

const routes = Router();

routes.get('/event/:eventId', validate(validations.getEvent), tokenController.getEvent);
routes.post('/event', upload.single('image'), validate(validations.empty), tokenController.createEvent);

routes.post('/wallet', validate(validations.empty), tokenController.createWallet);

export default routes;
