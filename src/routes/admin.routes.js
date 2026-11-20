const { Router } = require('express');
const {
  getAdminOverview,
  getAllUsers,
  getUserById,
  toggleBlockUser,
  getAllServicesAdmin,
  updateServiceStatus,
  deleteServiceAdmin,
  getAllTransactions,
} = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware');

const router = Router();

// Protect all admin endpoints with authentication and admin role verification
router.use(authenticate, requireAdmin);

router.get('/overview', getAdminOverview);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/block', toggleBlockUser);
router.put('/users/:id/block', toggleBlockUser);

router.get('/services', getAllServicesAdmin);
router.patch('/services/:id/status', updateServiceStatus);
router.put('/services/:id/status', updateServiceStatus);
router.delete('/services/:id', deleteServiceAdmin);

router.get('/transactions', getAllTransactions);

module.exports = router;
