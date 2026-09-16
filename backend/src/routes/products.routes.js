import { Router } from 'express';
import {
  getProducts, getProduct, createProduct, updateProduct,
  updateProductStatus, deleteProduct, getLowStockProducts,
  getUnitBreakdown
} from '../controllers/products.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, getProducts);
router.get('/low-stock', authenticate, getLowStockProducts);
router.get('/unit-breakdown', authenticate, getUnitBreakdown);
router.get('/:id', authenticate, getProduct);
router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.patch('/:id/status', authenticate, updateProductStatus);
router.delete('/:id', authenticate, deleteProduct);

export default router;
