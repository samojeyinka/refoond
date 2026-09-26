import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/http';
import {
  adminGetRequest,
  adminListRequests,
  adminResolveRequest,
  createRequest,
  getPolicy,
  getRequest,
  listMyOrders,
  listMyRequests,
  listMyRequestsSchema,
  listMyOrdersSchema,
  requestIdSchema,
  createRefundSchema,
  resolveSchema,
  sendMessageSchema,
  sendAiMessageSchema,
  adminListSchema,
  sendMessage,
  sendAiMessage,
  markSeen,
} from './refunds.controller';

const router = Router();

router.get('/policy', asyncHandler(getPolicy));

router.get('/orders', requireAuth, validate(listMyOrdersSchema), asyncHandler(listMyOrders));
router.get('/requests', requireAuth, validate(listMyRequestsSchema), asyncHandler(listMyRequests));
router.post('/requests', requireAuth, validate(createRefundSchema), asyncHandler(createRequest));

router.use('/admin', requireAuth, requireRole('ADMIN'));

router.get('/admin/requests', validate(adminListSchema), asyncHandler(adminListRequests));
router.get('/admin/requests/:requestId', validate(requestIdSchema), asyncHandler(adminGetRequest));
router.post(
  '/admin/requests/:requestId/resolve',
  validate(resolveSchema),
  asyncHandler(adminResolveRequest),
);

router.get(
  '/requests/:requestId',
  requireAuth,
  validate(requestIdSchema),
  asyncHandler(getRequest),
);
router.post(
  '/requests/:requestId/seen',
  requireAuth,
  validate(requestIdSchema),
  asyncHandler(markSeen),
);
router.post(
  '/requests/:requestId/messages',
  requireAuth,
  validate(sendMessageSchema),
  asyncHandler(sendMessage),
);
router.post(
  '/requests/:requestId/ai-messages',
  requireAuth,
  validate(sendAiMessageSchema),
  asyncHandler(sendAiMessage),
);

export default router;
