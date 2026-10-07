import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠ The Play Store package name. It can never change after the first
  // upload — pick your final one before publishing (keep environment.storeUrl in sync).
  appId: 'com.notebookgungame.app',
  appName: '90s Gun Game',
  webDir: 'dist/frontend/browser',
  android: {
    backgroundColor: '#fbf6e6'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#fbf6e6',
      showSpinner: false
    }
  }
};

export default config;
