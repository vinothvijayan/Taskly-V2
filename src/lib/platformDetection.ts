import { Capacitor } from '@capacitor/core';

/**
 * Platform detection utility for determining authentication method
 */
export const isNative = () => Capacitor.isNativePlatform();
export const isWeb = () => !Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform();

/**
 * Check if running in development mode
 */
export const isDevelopment = () => process.env.NODE_ENV === 'development';

/**
 * Get platform-specific configuration
 */
export const getPlatformConfig = () => ({
  isNative: isNative(),
  isWeb: isWeb(),
  platform: getPlatform(),
  isDevelopment: isDevelopment(),
});