#!/usr/bin/env node

/**
 * Test Helper Script: Verify Email for Testing
 * 
 * Usage:
 *   npm run verify-email <email>
 *   npm run verify-email <verification-code>
 * 
 * This script helps verify test accounts during development
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyByEmail(email) {
  try {
    // Find the verification record
    const { data: verification, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('type', 'signup')
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !verification) {
      console.error('❌ No pending verification found for:', email);
      return;
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      console.error('❌ Failed to verify:', updateError.message);
      return;
    }

    console.log('\n✅ EMAIL VERIFIED SUCCESSFULLY');
    console.log('=====================================');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Verification Code: ${verification.verification_code}`);
    console.log(`🔗 Token: ${verification.token}`);
    console.log('=====================================\n');
    console.log('The user can now log in and access the dashboard!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function verifyByCode(code) {
  try {
    // Find the verification record by code
    const { data: verification, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('verification_code', code)
      .eq('type', 'signup')
      .is('verified_at', null)
      .single();

    if (error || !verification) {
      console.error('❌ No pending verification found for code:', code);
      return;
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateError) {
      console.error('❌ Failed to verify:', updateError.message);
      return;
    }

    console.log('\n✅ EMAIL VERIFIED SUCCESSFULLY');
    console.log('=====================================');
    console.log(`📧 Email: ${verification.email}`);
    console.log(`🔑 Verification Code: ${code}`);
    console.log('=====================================\n');
    console.log('The user can now log in and access the dashboard!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function listPendingVerifications() {
  try {
    const { data: verifications, error } = await supabase
      .from('email_verifications')
      .select('email, verification_code, created_at')
      .eq('type', 'signup')
      .is('verified_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Failed to list verifications:', error.message);
      return;
    }

    if (!verifications || verifications.length === 0) {
      console.log('No pending email verifications found.');
      return;
    }

    console.log('\n📋 PENDING EMAIL VERIFICATIONS');
    console.log('=====================================');
    verifications.forEach((v, i) => {
      const created = new Date(v.created_at);
      const age = Math.floor((Date.now() - created) / 1000 / 60); // minutes
      console.log(`${i + 1}. ${v.email}`);
      console.log(`   Code: ${v.verification_code} | Created: ${age} minutes ago`);
    });
    console.log('=====================================\n');
    console.log('Use: npm run verify-email <email-or-code> to verify');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Main execution
const arg = process.argv[2];

if (!arg) {
  console.log('📧 Email Verification Helper\n');
  console.log('Usage:');
  console.log('  npm run verify-email <email>     - Verify by email address');
  console.log('  npm run verify-email <code>      - Verify by 6-digit code');
  console.log('  npm run verify-email --list      - List pending verifications\n');
  listPendingVerifications();
} else if (arg === '--list') {
  listPendingVerifications();
} else if (arg.includes('@')) {
  // It's an email
  verifyByEmail(arg);
} else if (/^\d{6}$/.test(arg)) {
  // It's a 6-digit code
  verifyByCode(arg);
} else {
  console.error('❌ Invalid input. Use an email address or 6-digit verification code.');
}