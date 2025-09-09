#!/usr/bin/env node
import 'dotenv/config';
import serverInstance from './server';
import { NATIVE_SERVER_PORT } from './constant';
import nativeMessagingHostInstance from './native-messaging-host';

try {
  serverInstance.setNativeHost(nativeMessagingHostInstance); // Server needs setNativeHost method
  nativeMessagingHostInstance.setServer(serverInstance); // NativeHost needs setServer method
  nativeMessagingHostInstance.start();
  // Optional: auto-start HTTP MCP if requested (useful for smoke tests)
  if (process.env.MCP_HTTP_AUTOSTART === '1') {
    serverInstance
      .start(NATIVE_SERVER_PORT, nativeMessagingHostInstance)
      .catch(() => {
        /* ignore */
      });
  }
} catch (error) {
  process.exit(1);
}

process.on('error', (error) => {
  process.exit(1);
});

// Handle process signals and uncaught exceptions
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('exit', (code) => {
});

process.on('uncaughtException', (error) => {
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Don't exit immediately, let the program continue running
});
