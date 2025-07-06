import { Hono } from "hono";
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDnsController } from "./controllers/dns-controller";
import { createSpfController } from "./controllers/spf-controller";
import { createDohController, createDohListController } from "./controllers/doh-controller";
import { getConfig } from "./config";
import { logger as appLogger } from "./utils/logger";

// Create app factory to handle environment variables
function createApp(env?: Record<string, string>) {
  const config = getConfig(env);
  
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  // Configure logging level
  appLogger.setLogLevel(config.logging.level as any);

  // Global middleware
  app.use('*', logger());
  app.use('*', cors({
    origin: config.server.cors.origins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  }));

  // Health check endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'Gemini DNS Checker',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: {
        dns: '/checkDNS?domain=example.com',
        spf: '/spf?domain=example.com',
        dohUrl: '/doh-url',
        dohUrls: '/doh-urls'
      }
    });
  });

  // API routes
  app.get("/checkDNS", createDnsController(config));
  app.get("/spf", createSpfController(config));
  app.get("/doh-url", createDohController(config));
  app.get("/doh-urls", createDohListController(config));

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: 'Endpoint not found',
      availableEndpoints: ['/checkDNS', '/spf', '/doh-url', '/doh-urls'],
      timestamp: new Date().toISOString()
    }, 404);
  });

  // Global error handler
  app.onError((err, c) => {
    const requestId = crypto.randomUUID();
    
    appLogger.error('Unhandled application error', err, { 
      requestId,
      path: c.req.path,
      method: c.req.method 
    });

    return c.json({
      error: 'Internal server error',
      requestId,
      timestamp: new Date().toISOString()
    }, 500);
  });

  return app;
}

// Export default app with default config for development
export default createApp();
