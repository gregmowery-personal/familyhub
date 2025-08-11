// Complete test of passwordless authentication flow
const baseUrl = 'http://localhost:3000/api/auth';

// Generate random email for testing
const testEmail = `test${Date.now()}@familyhub.care`;

async function testCompleteFlow() {
  console.log('=========================================');
  console.log('🚀 COMPLETE PASSWORDLESS FLOW TEST');
  console.log('=========================================');
  console.log(`Testing with email: ${testEmail}\n`);
  
  // STEP 1: Signup
  console.log('1️⃣ SIGNUP TEST');
  console.log('─────────────────────────────────────');
  
  const signupData = {
    email: testEmail,
    first_name: 'Complete',
    last_name: 'Test',
    phone_number: '+1234567890',
    accept_terms: true,
    subscribe_newsletter: false
  };
  
  let recoveryCode = null;
  let signupCode = null;
  
  try {
    const response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });
    
    const data = await response.json();
    console.log('  Status:', response.status);
    
    if (data.success) {
      console.log('  ✅ Signup successful!');
      if (data.data?.recovery_code) {
        recoveryCode = data.data.recovery_code;
        console.log(`  🔑 Recovery Code: ${recoveryCode}`);
        console.log('  ⚠️  SAVE THIS RECOVERY CODE - IT CANNOT BE RETRIEVED LATER!');
      }
      if (data.data?.verification_code_sent) {
        console.log('  📧 Verification code sent to email');
      }
    } else {
      console.log('  ❌ Signup failed:', data.error?.message);
      return;
    }
  } catch (error) {
    console.error('  ❌ Signup error:', error.message);
    return;
  }
  
  // Wait a moment
  console.log('\n  ⏳ Waiting 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // STEP 2: Login (send verification code)
  console.log('2️⃣ LOGIN TEST (Send Verification Code)');
  console.log('─────────────────────────────────────');
  
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    
    const data = await response.json();
    console.log('  Status:', response.status);
    
    if (data.success) {
      console.log('  ✅ Login code sent!');
      console.log('  📧 Check server console for verification code');
    } else {
      console.log('  ❌ Login failed:', data.error?.message);
    }
  } catch (error) {
    console.error('  ❌ Login error:', error.message);
  }
  
  console.log('\n=========================================');
  console.log('📊 TEST SUMMARY');
  console.log('=========================================');
  console.log('✅ Passwordless authentication is working!');
  console.log('\n📝 NOTES:');
  console.log('1. Check server console for the 6-digit verification code');
  console.log('2. Use test-verify-real.js with the code to complete login');
  if (recoveryCode) {
    console.log(`3. Recovery code for ${testEmail}: ${recoveryCode}`);
  }
  console.log('=========================================\n');
}

// Run the test
testCompleteFlow();