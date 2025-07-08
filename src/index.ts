import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDnsController } from './controllers/dns-controller';
import { createSpfController } from './controllers/spf-controller';
import { createDohController, createDohListController } from './controllers/doh-controller';
import { DkimController } from './controllers/dkim-controller';
import { DmarcController } from './controllers/dmarc-controller';
import { DnsServiceImpl } from './services/dns-service';
import { DkimService } from './services/dkim-service';
import { DmarcServiceImpl } from './services/dmarc-service';
import { getConfig } from './config';
import { logger as appLogger } from './utils/logger';
import { createScoreController } from './controllers/score-controller';

// Create app factory to handle environment variables
function createApp(env?: Record<string, string>) {
  const config = getConfig(env);
  
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  // Configure logging level
  appLogger.setLogLevel(config.logging.level as any);

  // Initialize services
  const dnsService = new DnsServiceImpl();
  const dkimService = new DkimService(dnsService);
  const dkimController = new DkimController(dkimService);
  const dmarcService = new DmarcServiceImpl(dnsService);
  const dmarcController = new DmarcController(dmarcService);

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
        dns: '/api/dns/:domain',
        spf: '/api/spf/:domain',
        dkim: '/api/dkim/:domain',
        dmarc: '/api/dmarc/:domain',
        doh: '/api/doh/:domain'
      }
    });
  });

  // DNS routes
  app.get('/api/dns', createDnsController(config));
  app.get('/api/dns/txt', createDnsController(config));

  // DoH routes
  app.get('/api/doh', createDohController(config));
  app.get('/api/doh/urls', createDohListController(config));

  // SPF routes
  app.get('/api/spf', createSpfController(config));
  app.get('/api/spf/score', createSpfController(config));

  // DKIM routes
  app.get('/api/dkim', (c) => dkimController.getDkimRecords(c));
  app.get('/api/dkim/record', (c) => dkimController.getDkimRecord(c));
  app.get('/api/dkim/validate', (c) => dkimController.validateDkimRecords(c));

  // DMARC routes
  app.get('/api/dmarc', (c) => dmarcController.getDmarcRecord(c));
  app.get('/api/dmarc/validate', (c) => dmarcController.validateDmarcRecord(c));

  // Score route
  app.get('/api/score', createScoreController(config));

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: 'Endpoint not found',
      availableEndpoints: [
        '/api/dns?domain=example.com',
        '/api/dns/txt?domain=example.com',
        '/api/doh?domain=example.com',
        '/api/doh/urls',
        '/api/spf?domain=example.com',
        '/api/spf/score?domain=example.com',
        '/api/dkim?domain=example.com',
        '/api/dkim/record?domain=example.com&selector=default',
        '/api/dkim/validate?domain=example.com',
        '/api/dmarc?domain=example.com',
        '/api/dmarc/validate?domain=example.com'
      ],
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
