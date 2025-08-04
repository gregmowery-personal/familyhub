"use client";

import Header from '@/components/Header';

export default function TermsAndConditions() {
  return (
    <div>
      <Header />
      <main id="main-content" className="min-h-screen bg-gradient-to-b from-secondary/30 via-base-100 to-accent/20" role="main">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-neutral-900">📜 Terms and Conditions</h1>
          
          <div className="prose prose-lg max-w-none text-neutral-700">
            <p className="text-xl mb-8 text-neutral-600">
              Welcome to FamilyHub. These terms govern your use of our family coordination platform. 
              By accessing or using FamilyHub, you agree to be bound by these Terms and our Privacy Policy.
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By creating an account or using FamilyHub, you confirm that you are at least 18 years old, have read, 
                understood, and agree to these Terms and Conditions and our Privacy Policy. If you do not agree, 
                please do not use the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">2. Description of Service</h2>
              <p className="mb-4">
                FamilyHub is a digital platform that helps families organize and coordinate shared responsibilities. 
                Key features include:
              </p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Shared family calendar and event scheduling</li>
                <li>Reminders and alerts for non-medical tasks</li>
                <li>Household and child activity planning</li>
                <li>Secure storage for family documents (e.g. school forms, contact lists)</li>
                <li>Internal communication tools for coordination</li>
              </ul>
              
              <div className="bg-error/10 border-l-4 border-error p-4 my-4">
                <p className="font-semibold text-neutral-800 mb-2">🛑 FamilyHub is Not a Medical Platform</p>
                <p className="text-neutral-700 mb-3">
                  FamilyHub is not designed to store or process medical records or health-related data and is not 
                  compliant with HIPAA. Users must not upload or store protected health information (PHI).
                </p>
                <p className="text-neutral-700">
                  <strong>Acceptable examples:</strong><br/>
                  ✅ &ldquo;Mom&apos;s dentist appointment at 10am&rdquo;<br/>
                  🚫 &ldquo;Mom&apos;s dental x-ray results are back; here are the notes…&rdquo;
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">3. Account Registration</h2>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>You must provide accurate and complete information.</li>
                <li>You are responsible for your login credentials and activity under your account.</li>
                <li>If you become aware of unauthorized access, notify us immediately.</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Family Accounts:</h3>
              <p className="mb-4">
                The primary account holder may invite other users to join their FamilyHub. Each user must accept 
                these Terms before participating. The primary user has administrative control over family access.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">4. Acceptable Use</h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Use FamilyHub for illegal, abusive, or unauthorized purposes</li>
                <li>Upload malicious code or attempt to compromise system security</li>
                <li>Harass or impersonate other users</li>
                <li>Share content that infringes on rights of others</li>
                <li>Use FamilyHub for commercial or resale purposes without consent</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">5. Content and Data Ownership</h2>
              <p className="mb-4">
                You retain full ownership of the content you upload to FamilyHub. You grant us a limited license to 
                store and process your content solely for the purpose of providing the service.
              </p>
              
              <p className="mb-4 font-semibold">You must NOT upload:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Medical records or health history</li>
                <li>Medication names, dosages, or prescriptions</li>
                <li>Insurance claims or clinical documentation</li>
                <li>Sensitive or regulated health information of any kind</li>
              </ul>
              
              <p className="mb-4">
                Simple reminders for personal health activities (e.g., &ldquo;Take vitamin D&rdquo; or &ldquo;Doctor at 2pm&rdquo;) are 
                permitted, but these should be non-diagnostic and non-clinical.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">6. Privacy and Security</h2>
              <p className="mb-4">
                We implement modern, reasonable technical measures to safeguard your data. However, no system is 100% 
                secure, and we cannot guarantee absolute protection. Use the service at your own discretion.
              </p>
              <p className="mb-4">
                Please refer to our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for more information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">7. Subscriptions and Payment</h2>
              <p className="mb-4">FamilyHub offers both free and paid subscription plans.</p>
              
              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Premium Plans May Include:</h3>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Enhanced storage</li>
                <li>Priority support</li>
                <li>Advanced collaboration tools</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Billing Terms:</h3>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Subscriptions are billed monthly or annually</li>
                <li>Pricing is subject to change with 30 days&apos; notice</li>
                <li>Payments are non-refundable except as required by law</li>
                <li>Cancel anytime through your account dashboard</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">8. Intellectual Property</h2>
              <p className="mb-4">
                All software, branding, design, and content provided by FamilyHub remain the property of FamilyHub, Inc. 
                You may not reproduce, distribute, or create derivative works without written permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">9. Third-Party Services</h2>
              <p className="mb-4">
                FamilyHub may offer integrations (e.g., calendar tools). Use of third-party services is subject to 
                their terms. We are not responsible for any issues arising from third-party platforms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">10. Disclaimers</h2>
              
              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Not a Medical Service:</h3>
              <p className="mb-4">FamilyHub is not a healthcare product. We do not:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Provide medical advice or diagnoses</li>
                <li>Store or process medical or clinical data</li>
                <li>Support HIPAA compliance</li>
                <li>Replace professional consultation</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Platform Reliability:</h3>
              <p className="mb-4">
                FamilyHub is provided &ldquo;as is&rdquo; without warranties of any kind. We strive to maintain uptime and 
                reliability but cannot guarantee uninterrupted service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">11. Limitation of Liability</h2>
              <p className="mb-4">To the extent permitted by law, FamilyHub is not liable for:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Indirect, incidental, or consequential damages</li>
                <li>Loss of data, profits, or business</li>
                <li>Service interruptions or unauthorized access</li>
              </ul>
              <p className="mb-4">Use of FamilyHub is at your sole risk.</p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">12. Indemnification</h2>
              <p className="mb-4">
                You agree to indemnify and hold harmless FamilyHub, its affiliates, and team members from any claims, 
                damages, or legal actions arising from your misuse of the service or violation of these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">13. Termination</h2>
              <p className="mb-4">
                We may suspend or terminate your access at any time, with or without notice, for violation of these 
                terms. Upon termination, you lose access to all content and data unless required to be retained by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">14. Governing Law</h2>
              <p className="mb-4">
                These terms are governed by the laws of California, USA. Any disputes shall be resolved in courts 
                located in San Francisco County, California.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">15. Modifications to Terms</h2>
              <p className="mb-4">
                We may revise these Terms at any time. Material updates will be communicated via email or in-app 
                notice. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">16. Accessibility Commitment</h2>
              <p className="mb-4">
                We aim to meet or exceed WCAG 2.1 AA standards. If you encounter issues accessing our service, 
                please contact us for assistance.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-base-300">
              <p className="text-sm text-neutral-600">
                Last updated: January 3, 2025
              </p>
              <p className="text-sm text-neutral-600 mt-2">
                Effective date: January 1, 2025
              </p>
              <p className="text-sm text-neutral-600 mt-4">
                © 2025 FamilyHub, Inc. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}