import { Request, Response } from 'express'
import axios from 'axios'
import prisma from '../database'

const PRICE_CONVERSION_DIVISOR = 70
const PRICE_CONVERSION_MULTIPLIER = 100

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  // Prisma Decimal приходит как объект с toString()
  if (value && typeof value === 'object' && typeof (value as any).toString === 'function') {
    const parsed = Number((value as any).toString())
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toGlovoPriceString(originalPrice: unknown): string {
  const priceNumber = toNumber(originalPrice)
  const converted = (priceNumber / PRICE_CONVERSION_DIVISOR) * PRICE_CONVERSION_MULTIPLIER
  // Glovo API ожидает строки (как в примере) — фиксируем 2 знака
  return converted.toFixed(2)
}

/**
 * Контроллер `глово` — отвечает за отправку ассортимента в Glovo.
 * Пока что реализована заглушка: принимает ассортимент в `req.body`
 * и возвращает подтверждение принятия в стандартном формате API.
 */
export const glovoController = {
  sendAssortment: async (req: Request, res: Response) => {
    try {
      const assortment = req.body

      // Простая валидация
      if (!Array.isArray(assortment) || assortment.length === 0) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Assortment must be a non-empty array',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // Конфигурация интеграции через переменные окружения
      const glovoUrl = process.env.GLOVO_API_URL || ''
      const glovoKey = process.env.GLOVO_API_KEY || ''

      if (!glovoUrl || !glovoKey) {
        return res.status(500).json({
          success: false,
          data: null,
          error: {
            message: 'Glovo integration not configured (GLOVO_API_URL or GLOVO_API_KEY missing)',
            statusCode: 500,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // Трансформация payload по необходимости — здесь отправляем как { items: [...] }
      const payload = { items: assortment }

      const response = await axios.post(glovoUrl, payload, {
        headers: {
          Authorization: `Bearer ${glovoKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      })

      return res.status(200).json({
        success: true,
        data: { glovoStatus: response.status, glovoData: response.data },
        message: 'Assortment sent to Glovo',
      })
    } catch (error: any) {
      const timestamp = new Date().toISOString()
      // Если ошибка от axios — пробуем вернуть полезный ответ
      if (axios.isAxiosError(error) && error.response) {
        return res.status(502).json({
          success: false,
          data: null,
          error: {
            message: 'Error from Glovo API',
            statusCode: error.response.status,
            timestamp,
          },
        })
      }

      return res.status(500).json({
        success: false,
        data: null,
        error: {
          message: error?.message || 'Internal server error',
          statusCode: 500,
          timestamp,
        },
      })
    }
  },
  bulkUpdate: async (req: Request, res: Response) => {
    try {
      const { storeId } = req.params
      const payload = req.body

      if (!storeId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'storeId parameter is required',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          },
        })
      }

      // Проверяем что есть хотя бы один раздел в теле
      const hasProducts = Array.isArray(payload?.products) && payload.products.length > 0
      const hasAttributes = Array.isArray(payload?.attributes) && payload.attributes.length > 0
      const hasPromotions = Array.isArray(payload?.promotions) && payload.promotions.length > 0

      if (!hasProducts && !hasAttributes && !hasPromotions) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'Payload must contain at least one of products, attributes or promotions arrays',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          },
        })
      }

      const glovoUrlBase = process.env.GLOVO_API_URL || ''
      const glovoKey = process.env.GLOVO_API_KEY || ''

      if (!glovoUrlBase || !glovoKey) {
        return res.status(500).json({
          success: false,
          data: null,
          error: {
            message: 'Glovo integration not configured (GLOVO_API_URL or GLOVO_API_KEY missing)',
            statusCode: 500,
            timestamp: new Date().toISOString(),
          },
        })
      }

      const base = glovoUrlBase.replace(/\/$/, '')
      const url = `${base}/webhook/stores/${encodeURIComponent(storeId)}/menu/updates`

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${glovoKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      })

      return res.status(200).json({
        success: true,
        data: { glovoStatus: response.status, glovoData: response.data },
        message: 'Bulk menu update sent to Glovo',
      })
    } catch (error: any) {
      const timestamp = new Date().toISOString()
      if (axios.isAxiosError(error) && error.response) {
        return res.status(502).json({
          success: false,
          data: null,
          error: {
            message: 'Error from Glovo API',
            statusCode: error.response.status,
            timestamp,
          },
        })
      }

      return res.status(500).json({
        success: false,
        data: null,
        error: {
          message: error?.message || 'Internal server error',
          statusCode: 500,
          timestamp,
        },
      })
    }
  },
  updateMenusFromDb: async (req: Request, res: Response) => {
    try {
      // Можно обновить один бизнес: ?business_id=123
      const businessIdParam = req.query.business_id
      const businessId = businessIdParam ? Number(businessIdParam) : null
      if (businessIdParam && (!Number.isFinite(businessId) || businessId! <= 0)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            message: 'business_id must be a positive number',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          },
        })
      }

      const glovoUrlBase = (process.env.GLOVO_API_URL || 'https://api.glovoapp.com').replace(/\/$/, '')
      const fallbackToken = process.env.GLOVO_API_KEY || ''

      const businesses = await prisma.businesses.findMany({
        where: {
          glovo_id: { not: null },
          ...(businessId ? { business_id: businessId } : {}),
        },
        select: {
          business_id: true,
          name: true,
          glovo_id: true,
          glovo_token: true,
        },
      })

      if (businesses.length === 0) {
        return res.status(200).json({
          success: true,
          data: { updated: 0, results: [] },
          message: 'No businesses with glovo_id found',
        })
      }

      const results: any[] = []

      for (const business of businesses) {
        const storeId = business.glovo_id
        const token = business.glovo_token || fallbackToken

        if (!storeId) {
          results.push({
            business_id: business.business_id,
            status: 'skipped',
            reason: 'glovo_id is empty',
          })
          continue
        }

        if (!token) {
          results.push({
            business_id: business.business_id,
            glovo_id: storeId,
            status: 'failed',
            error: 'Missing glovo_token for business and no GLOVO_API_KEY fallback',
          })
          continue
        }

        try {
          // Берём товары бизнеса
          const items = await prisma.items.findMany({
            where: {
              business_id: business.business_id,
              visible: 1,
            },
            select: {
              item_id: true,
              name: true,
              price: true,
              img: true,
              visible: true,
            },
          })

          const itemIds = items.map(i => i.item_id)

          const [latestPrices, stockData] = await Promise.all([
            itemIds.length
              ? prisma.prices.findMany({
                  where: { item_id: { in: itemIds } },
                  orderBy: { log_timestamp: 'desc' },
                  distinct: ['item_id'],
                  select: { item_id: true, price: true },
                })
              : Promise.resolve([]),
            itemIds.length
              ? prisma.items_in_stock.findMany({
                  where: { item_id: { in: itemIds } },
                  orderBy: { log_timestamp: 'desc' },
                  distinct: ['item_id'],
                  select: { item_id: true, amount: true },
                })
              : Promise.resolve([]),
          ])

          const products = items.map(item => {
            const priceRow = latestPrices.find(p => p.item_id === item.item_id)
            const stockRow = stockData.find(s => s.item_id === item.item_id)
            const currentPrice = priceRow?.price ?? item.price ?? 0
            const stockAmount = toNumber(stockRow?.amount ?? 0)
            const available = item.visible === 1 && stockAmount > 0

            return {
              id: String(item.item_id),
              name: item.name,
              price: toGlovoPriceString(currentPrice),
              image_url: item.img || '',
              available,
              quantity: String(stockAmount),
            }
          })

          const url = `${glovoUrlBase}/webhook/stores/${encodeURIComponent(storeId)}/menu/updates`
          const payload = { products }

          const response = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          })

          results.push({
            business_id: business.business_id,
            glovo_id: storeId,
            status: 'ok',
            sent_products: products.length,
            glovo_status: response.status,
          })
        } catch (error: any) {
          if (axios.isAxiosError(error) && error.response) {
            results.push({
              business_id: business.business_id,
              glovo_id: storeId,
              status: 'failed',
              glovo_status: error.response.status,
              error: 'Error from Glovo API',
            })
            continue
          }

          results.push({
            business_id: business.business_id,
            glovo_id: storeId,
            status: 'failed',
            error: error?.message || 'Internal error',
          })
        }
      }

      const okCount = results.filter(r => r.status === 'ok').length
      const failCount = results.filter(r => r.status === 'failed').length

      return res.status(200).json({
        success: true,
        data: {
          updated: okCount,
          failed: failCount,
          results,
          price_formula: '(price/70)*100',
        },
        message: 'Glovo menu updates processed',
      })
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        data: null,
        error: {
          message: error?.message || 'Internal server error',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      })
    }
  },
}

export default glovoController
