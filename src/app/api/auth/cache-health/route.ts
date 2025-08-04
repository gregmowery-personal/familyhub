import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationService } from '@/lib/auth/authorization-service'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/cache-health
 * 
 * Returns cache health metrics and performance statistics
 * Requires admin privileges
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permission
    const authService = getAuthorizationService()
    const authResult = await authService.authorize(
      user.id,
      'admin.cache.read',
      'system',
      'cache'
    )

    if (!authResult.allowed) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get cache health and metrics
    const [cacheHealth, cacheMetrics, hitRates] = await Promise.all([
      authService.getCacheHealth(),
      authService.getCacheMetrics(),
      Promise.resolve(authService.getCacheHitRate())
    ])

    return NextResponse.json({
      health: cacheHealth,
      metrics: cacheMetrics,
      performance: {
        hitRates,
        l1CacheUtilization: cacheHealth.l1Cache.size / cacheHealth.l1Cache.maxSize,
        overallHealth: cacheHealth.l1Cache.status === 'healthy' && 
                      (cacheHealth.l2Cache.status === 'healthy' || cacheHealth.l2Cache.status === 'disabled') &&
                      hitRates.overall > 0.5 ? 'healthy' : 'degraded'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cache health check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/cache-health
 * 
 * Cache management operations (clear, warmup, etc.)
 * Requires admin privileges
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check admin permission
    const authService = getAuthorizationService()
    const authResult = await authService.authorize(
      user.id,
      'admin.cache.manage',
      'system',
      'cache'
    )

    if (!authResult.allowed) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'clear':
        await authService.clearAllCache()
        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully'
        })

      case 'warmup':
        const { userIds } = params
        if (!userIds || !Array.isArray(userIds)) {
          return NextResponse.json(
            { error: 'userIds array required for warmup' },
            { status: 400 }
          )
        }
        
        await authService.warmupCacheForUsers(userIds)
        return NextResponse.json({
          success: true,
          message: `Cache warmed up for ${userIds.length} users`
        })

      case 'invalidate':
        const { pattern } = params
        if (!pattern) {
          return NextResponse.json(
            { error: 'pattern required for invalidation' },
            { status: 400 }
          )
        }

        await authService.invalidateCache({
          type: 'PERMISSION_SET_UPDATED', // Generic invalidation
          permissionSetId: pattern
        })
        
        return NextResponse.json({
          success: true,
          message: `Cache invalidated for pattern: ${pattern}`
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: clear, warmup, invalidate' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Cache management error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}