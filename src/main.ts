import { AutomationController } from './controllers/AutomationController.js';

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Starting Threads Automation System...');
  console.log('📍 Current working directory:', process.cwd());
  console.log('📦 Node version:', process.version);
  console.log('🔧 Platform:', process.platform);
  
  try {
    console.log('🔍 Creating AutomationController...');
    const controller = new AutomationController();
    console.log('🔧 Controller created successfully');
    
    console.log('🚀 Starting multi-account automation...');
    await controller.runMultiAccountAutomation();
    console.log('✅ Threads Automation completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error in main process:', error.message);
    console.error('📋 Error stack:', error.stack);
    process.exit(1);
  }
}

// Chạy automation nếu là main module
if (process.argv[1] && (process.argv[1].endsWith('main.js') || process.argv[1].endsWith('main.ts'))) {
  console.log('🎯 Main module detected, starting automation...');
  main().catch(error => {
    console.error('💥 Unhandled error in main:', error);
    process.exit(1);
  });
} else {
  console.log('📦 Module imported, not running automation');
}

export { AutomationController };
