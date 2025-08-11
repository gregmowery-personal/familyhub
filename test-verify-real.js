// Test verification with real code
async function testVerifyWithRealCode() {
  console.log('\n✅ Testing Verify Code with REAL code from server console...\n');
  
  const verifyData = {
    email: 'test@familyhub.care',
    code: '577909', // Real code from server console
    rememberMe: false
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyData)
    });
    
    const data = await response.json();
    console.log('Verify Code Response:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('\n' + (data.success ? '✅ VERIFICATION SUCCESSFUL!' : '❌ VERIFICATION FAILED'));
    
    if (data.success) {
      console.log('\n🎉 SESSION DETAILS:');
      if (data.data?.session) {
        console.log('  Access Token:', data.data.session.access_token?.substring(0, 20) + '...');
        console.log('  Expires In:', data.data.session.expires_in, 'seconds');
      }
      if (data.data?.user) {
        console.log('  User ID:', data.data.user.id);
        console.log('  Email:', data.data.user.email);
      }
    }
  } catch (error) {
    console.error('Verify Code Error:', error);
  }
}

testVerifyWithRealCode();