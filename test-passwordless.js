// Test script for passwordless authentication
const baseUrl = 'http://localhost:3000/api/auth';

async function testSignup() {
  console.log('\n🚀 Testing Signup Flow...\n');
  
  const signupData = {
    email: 'test@familyhub.care',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+1234567890',
    accept_terms: true,
    subscribe_newsletter: false
  };
  
  try {
    const response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });
    
    const data = await response.json();
    console.log('Signup Response:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    if (data.data?.recovery_code) {
      console.log('\n🔑 RECOVERY CODE RECEIVED:', data.data.recovery_code);
    }
    
    return data.success;
  } catch (error) {
    console.error('Signup Error:', error);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔐 Testing Login Flow...\n');
  
  const loginData = {
    email: 'test@familyhub.care',
    remember_me: true
  };
  
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    
    const data = await response.json();
    console.log('Login Response:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    return data.success;
  } catch (error) {
    console.error('Login Error:', error);
    return false;
  }
}

async function testSendCode() {
  console.log('\n📨 Testing Send Code...\n');
  
  const sendCodeData = {
    email: 'test@familyhub.care',
    type: 'login'
  };
  
  try {
    const response = await fetch(`${baseUrl}/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendCodeData)
    });
    
    const data = await response.json();
    console.log('Send Code Response:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    return data.success;
  } catch (error) {
    console.error('Send Code Error:', error);
    return false;
  }
}

async function testVerifyCode(code) {
  console.log('\n✅ Testing Verify Code...\n');
  
  const verifyData = {
    email: 'test@familyhub.care',
    code: code || '123456', // Use provided code or default
    rememberMe: false
  };
  
  try {
    const response = await fetch(`${baseUrl}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyData)
    });
    
    const data = await response.json();
    console.log('Verify Code Response:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    
    return data.success;
  } catch (error) {
    console.error('Verify Code Error:', error);
    return false;
  }
}

async function runTests() {
  console.log('=========================================');
  console.log('🧪 PASSWORDLESS AUTH TEST SUITE');
  console.log('=========================================');
  
  // Test signup first
  const signupSuccess = await testSignup();
  console.log(`\n✓ Signup Test: ${signupSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test login (should work if user exists)
  const loginSuccess = await testLogin();
  console.log(`✓ Login Test: ${loginSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Test send code
  const sendCodeSuccess = await testSendCode();
  console.log(`✓ Send Code Test: ${sendCodeSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Test verify code (will fail with fake code)
  const verifySuccess = await testVerifyCode('123456');
  console.log(`✓ Verify Code Test: ${verifySuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  console.log('\n=========================================');
  console.log('📊 TEST SUMMARY');
  console.log('=========================================');
  console.log('Check the console output above for verification codes!');
  console.log('Look for the 6-digit codes to test real verification.');
  console.log('=========================================\n');
}

// Run the tests
runTests();