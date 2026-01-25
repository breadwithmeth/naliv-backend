import { Router } from 'express'
import glovoController from '../controllers/glovoController'

const router = Router()

// POST /api/glovo/assortment
router.post('/assortment', glovoController.sendAssortment)

// POST /api/glovo/stores/:storeId/menu/updates
router.post('/stores/:storeId/menu/updates', glovoController.bulkUpdate)

// POST /api/glovo/menu/update-from-db?business_id=123
router.post('/menu/update-from-db', glovoController.updateMenusFromDb)

export default router
