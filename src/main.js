import { AutomationController } from './controllers/AutomationController.js';

/**
 * Main entry point
 */
async function main() {
  try {
    const controller = new AutomationController();
    await controller.runMultiAccountAutomation();
  } catch (error) {
    process.exit(1);
  }
}

// Chạy automation nếu là main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AutomationController };
