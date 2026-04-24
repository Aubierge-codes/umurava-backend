import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import {
  submitAdminRequest,
  listAdminRequests,
  getMyAdminRequest,
  reviewAdminRequest,
} from '../controllers/adminRequest.controller';

const router = Router();

router.post('/',              authenticate,              submitAdminRequest);
router.get('/my',             authenticate,              getMyAdminRequest);
router.get('/',               authenticate, adminOnly,   listAdminRequests);
router.put('/:id/review',     authenticate, adminOnly,   reviewAdminRequest);

export default router;