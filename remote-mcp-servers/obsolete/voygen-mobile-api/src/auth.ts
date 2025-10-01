/**
 * Authentication and CORS handling
 */

import { Env, AuthResult } from './types';

/**
 * CORS headers for all responses
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Authenticate request using bearer token
 */
export function authenticate(request: Request, env: Env): AuthResult {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Missing or invalid Authorization header' };
  }
  
  const token = authHeader.substring(7);
  
  // For MVP, use simple dev token
  if (token === env.AUTH_SECRET) {
    return { success: true, owner: 'dev-user' };
  }
  
  return { success: false, error: 'Invalid token' };
}