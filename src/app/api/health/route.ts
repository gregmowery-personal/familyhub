import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Test database connection
    const supabase = await createClient();
    const { error } = await supabase.from('families').select('id').limit(1);
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: error ? 'unhealthy' : 'healthy',
        authentication: 'healthy',
        api: 'healthy',
      },
      version: '1.0.0',
    };

    if (error) {
      console.error('Health check database error:', error);
      return NextResponse.json(
        {
          ...healthData,
          status: 'degraded',
          services: {
            ...healthData.services,
            database: 'unhealthy',
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(healthData, { status: 200 });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        services: {
          database: 'unknown',
          authentication: 'unknown',
          api: 'unhealthy',
        },
        version: '1.0.0',
      },
      { status: 503 }
    );
  }
}