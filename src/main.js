import { AutomationController } from './controllers/AutomationController.js';

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Starting Threads Automation System...');
  console.log('📍 Current working directory:', process.cwd());
  
  try {
    const controller = new AutomationController();
    console.log('🔧 Controller created successfully');
    
    await controller.runMultiAccountAutomation();
    console.log('✅ Threads Automation completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error in main process:', error.message);
    console.error('📋 Error stack:', error.stack);
    process.exit(1);
  }
}

// Chạy automation nếu là main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AutomationController };
