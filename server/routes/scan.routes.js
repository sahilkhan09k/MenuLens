import { Router } from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { scanUploadLimiter } from '../middleware/rateLimit.middleware.js';
import { uploadImages, handleUploadError } from '../middleware/upload.middleware.js';
import {
  uploadScan,
  getScan,
  getHistory,
  getLastScan,
  toggleSave,
  deleteScan,
} from '../controllers/scan.controller.js';

const router = Router();

router.use(protect);

router.post('/', scanUploadLimiter, uploadImages, handleUploadError, uploadScan);
router.get('/history', getHistory);
router.get('/last', getLastScan);
router.get('/:scanId', getScan);
router.put('/:scanId/save', toggleSave);
router.delete('/:scanId', deleteScan);

export default router;
