console.log('🔍 Starting debug...');

// Test 1: Import constants
try {
  console.log('📦 Testing constants import...');
  const { THREADS_URL } = await import('./src/config/constants.js');
  console.log('✅ Constants loaded:', THREADS_URL);
} catch (error) {
  console.error('❌ Constants error:', error.message);
}

// Test 2: Import ProfileService
try {
  console.log('📦 Testing ProfileService import...');
  const { ProfileService } = await import('./src/services/ProfileService.js');
  console.log('✅ ProfileService loaded');
  
  const service = new ProfileService();
  console.log('✅ ProfileService instance created');
  
  const profiles = await service.loadProfiles();
  console.log('✅ Profiles loaded:', profiles.length);
} catch (error) {
  console.error('❌ ProfileService error:', error.message);
}

// Test 3: Import AutomationController
try {
  console.log('📦 Testing AutomationController import...');
  const { AutomationController } = await import('./src/controllers/AutomationController.js');
  console.log('✅ AutomationController loaded');
} catch (error) {
  console.error('❌ AutomationController error:', error.message);
}

console.log('🎉 Debug completed!');
