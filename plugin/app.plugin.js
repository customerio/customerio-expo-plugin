// For development testing, we directly require the source files
// This allows us to test changes without needing to rebuild the plugin
try {
  module.exports = require("./lib/commonjs/index");
} catch (error) {
  // Fallback to src for development
  console.log("Using source files directly for testing - attempting to register ts-node");
  try {
    // Try to register ts-node for TypeScript compilation on the fly
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: "commonjs",
        target: "es2017",
      }
    });
    module.exports = require("./src/index");
  } catch (tsNodeError) {
    console.error("Could not load ts-node for TypeScript compilation:", tsNodeError.message);
    console.log("Trying to load compiled JavaScript files if they exist...");
    
    // As a last resort, try to find any .js files that may exist
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if index.js exists in the src directory (might have been compiled but not moved)
      const indexJsPath = path.resolve(__dirname, 'src', 'index.js');
      if (fs.existsSync(indexJsPath)) {
        console.log(`Found ${indexJsPath}, attempting to load it`);
        module.exports = require(indexJsPath);
      } else {
        console.error("Could not find any suitable module to load. Please rebuild the plugin.");
        throw new Error("CustomerIO Expo Plugin failed to load. Please rebuild the plugin with 'npm run build'.");
      }
    } catch (finalError) {
      console.error("Fatal error loading CustomerIO Expo Plugin:", finalError);
      throw finalError;
    }
  }
}
