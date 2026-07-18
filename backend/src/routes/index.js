import { Router } from 'express';
import v1Routes from './v1/index.js';
import { API_VERSION } from '../constants/index.js';

const router = Router();

router.use(`/${API_VERSION}`, v1Routes);

export default router;
