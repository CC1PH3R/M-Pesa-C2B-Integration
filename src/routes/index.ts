import { Router } from 'express';
import authRoutes from './auth.routes';
import c2bRoutes from './c2b.routes';
import stkPushRoutes from './stkpush.routes';

const router = Router();

router.use(authRoutes);
router.use(c2bRoutes);
router.use(stkPushRoutes);

export default router;
