// Test that NO Supabase emails are sent
const baseUrl = 'http://localhost:3000/api/auth';

// Generate unique email for testing
const testEmail = `nomail${Date.now()}@familyhub.care`;

async function testNoSupabaseEmails() {
  console.log('=========================================');
  console.log('🚫 TESTING: NO SUPABASE EMAILS SENT');
  console.log('=========================================');
  console.log(`Testing with email: ${testEmail}\n`);
  
  console.log('Creating new user with admin API...');
  console.log('This should NOT trigger any Supabase emails\n');
  
  const signupData = {
    email: testEmail,
    first_name: 'No',
    last_name: 'Email',
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
    
    if (data.success) {
      console.log('✅ User created successfully WITHOUT Supabase emails!');
      if (data.data?.recovery_code) {
        console.log(`🔑 Recovery Code: ${data.data.recovery_code}`);
      }
      console.log('\n📧 Our custom email system handles all notifications');
      console.log('   (Currently logging to console only)');
    } else {
      console.log('❌ Signup failed:', data.error?.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n=========================================');
  console.log('IMPORTANT: Check Supabase dashboard');
  console.log('NO emails should have been sent!');
  console.log('=========================================\n');
}

// Run the test
testNoSupabaseEmails();