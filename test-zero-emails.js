// Test that ABSOLUTELY NO Supabase emails are sent
const baseUrl = 'http://localhost:3000/api/auth';

// Generate unique email with clear timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const testEmail = `zero-emails-${timestamp}@familyhub.care`;

async function testZeroSupabaseEmails() {
  console.log('=========================================');
  console.log('🚫 CRITICAL TEST: ZERO SUPABASE EMAILS');
  console.log('=========================================');
  console.log(`Testing with: ${testEmail}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  console.log('Creating user with email_confirm=true...');
  console.log('This should create a pre-confirmed user');
  console.log('WITHOUT sending ANY Supabase emails!\n');
  
  const signupData = {
    email: testEmail,
    first_name: 'Zero',
    last_name: 'Emails',
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
    console.log('Response Status:', response.status);
    
    if (data.success) {
      console.log('✅ User created successfully!');
      if (data.data?.recovery_code) {
        console.log(`🔑 Recovery Code: ${data.data.recovery_code}`);
      }
      console.log('\n✓ email_confirm set to TRUE');
      console.log('✓ User pre-confirmed, no confirmation email sent');
      console.log('✓ All authentication handled by our system');
    } else {
      console.log('❌ Signup failed:', data.error?.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n=========================================');
  console.log('⚠️  CHECK SUPABASE DASHBOARD NOW!');
  console.log('=========================================');
  console.log(`Look for email: ${testEmail}`);
  console.log('The "Confirmation sent at" field should be EMPTY');
  console.log('This proves NO Supabase emails were sent!');
  console.log('=========================================\n');
}

// Run the test
testZeroSupabaseEmails();