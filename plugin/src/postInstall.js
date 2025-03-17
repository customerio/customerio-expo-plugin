try {
  const ph = require('./postInstallHelper');
  
  console.log('Running Customer.io Expo Plugin post-install checks...');
  ph.runPostInstall();
} catch (error) {
  console.warn('Error during Customer.io Expo Plugin post-install:', error);
}