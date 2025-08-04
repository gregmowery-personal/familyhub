"use client";

import Header from '@/components/Header';

export default function PrivacyPolicy() {
  return (
    <div>
      <Header />
      <main id="main-content" className="min-h-screen bg-gradient-to-b from-secondary/30 via-base-100 to-accent/20" role="main">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-neutral-900">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none text-neutral-700">
            <p className="text-sm text-neutral-600 mb-6">
              <strong>Effective Date:</strong> January 3, 2025
            </p>
            
            <p className="text-xl mb-8 text-neutral-600">
              At FamilyHub, your family&apos;s privacy is our top priority. We believe families should be able to coordinate 
              schedules and reminders without compromising their personal information.
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Our Privacy Promise</h2>
              <p className="mb-4">
                FamilyHub is built on trust. We will never sell, rent, or share your personal information with third 
                parties for marketing purposes. Your data belongs to you and your family alone.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Information We Collect</h2>
              <p className="mb-4">We collect only the information necessary to provide our service:</p>
              
              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Account Information</h3>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Names and family relationships</li>
                <li>Email addresses for login and notifications</li>
                <li>Phone numbers (optional, for SMS reminders)</li>
                <li>Profile photos (optional)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Scheduling and Reminder Information</h3>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Calendar events and appointments</li>
                <li>Task assignments and reminder descriptions (e.g., &ldquo;Take blood pressure medication&rdquo;)</li>
                <li>Non-medical family documents such as permission slips or sports schedules</li>
                <li>Communication between family members regarding scheduling</li>
              </ul>
              
              <div className="bg-warning/20 border-l-4 border-warning p-4 my-4">
                <p className="font-semibold text-neutral-800 mb-2">⚠️ Important Notice About Medical Information</p>
                <p className="text-neutral-700">
                  FamilyHub is not intended to store personal health information (PHI). Please do not upload medical 
                  records, prescription details, diagnoses, or treatment plans. You may set general reminders (e.g., 
                  &ldquo;Take medication&rdquo;), but avoid recording specific drug names, dosages, or medical conditions.
                </p>
              </div>

              <h3 className="text-xl font-semibold mb-3 text-neutral-800">Technical Information</h3>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Device type, operating system, and browser (for security and support)</li>
                <li>IP address (for fraud detection and prevention)</li>
                <li>Usage data (to improve our service, in aggregate and anonymized form)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">How We Use Your Information</h2>
              <p className="mb-4">We use your information solely to:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Operate and improve the FamilyHub service</li>
                <li>Send alerts and reminders related to tasks, events, and schedules</li>
                <li>Provide customer support</li>
                <li>Ensure account and system security</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p className="mb-4">
                <strong>We do not use your data for advertising or profiling.</strong>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Data Security</h2>
              <p className="mb-4">We use industry-standard safeguards to protect your data:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Encryption in transit and at rest (TLS/SSL and AES-256)</li>
                <li>Access controls and authentication for all system access</li>
                <li>Regular vulnerability assessments and audits</li>
                <li>Secure infrastructure providers with proven compliance practices (e.g., ISO 27001, SOC 2)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Your Rights and Choices</h2>
              <p className="mb-4">You are in control of your data:</p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li><strong>Access:</strong> View any information we&apos;ve collected about your family</li>
                <li><strong>Correction:</strong> Update your details at any time</li>
                <li><strong>Deletion:</strong> Request complete data removal (processed within 30 days)</li>
                <li><strong>Export:</strong> Download your family&apos;s data in a portable format</li>
                <li><strong>Opt-Out:</strong> Manage your notification preferences for email, SMS, and in-app messages</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Children&apos;s Privacy</h2>
              <p className="mb-4">
                FamilyHub is designed for adults (18+) managing family schedules. We do not knowingly collect personal 
                information directly from children under 13. Any information about children must be provided by a parent 
                or guardian for scheduling purposes only.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Data Retention</h2>
              <p className="mb-4">
                We retain your data only as long as necessary to provide our services. Upon account deletion, your data 
                is permanently removed from our systems within 30 days—except where retention is legally required (e.g., 
                for fraud prevention or financial records).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Third-Party Services</h2>
              <p className="mb-4">
                We use a limited set of carefully vetted service providers to support FamilyHub. These include:
              </p>
              <ul className="list-disc ml-6 mb-4 space-y-2">
                <li>Cloud hosting and infrastructure</li>
                <li>Email and SMS delivery</li>
                <li>Payment processors for premium plans</li>
                <li>Privacy-focused analytics tools (no personal data shared)</li>
              </ul>
              <p className="mb-4">
                All vendors are contractually required to safeguard your information and use it only to provide services 
                to FamilyHub.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Cookies and Tracking</h2>
              <p className="mb-4">
                FamilyHub uses essential cookies to keep you logged in and deliver core features. We may also use 
                anonymized tracking (e.g., page views) to improve usability. We do not use tracking cookies for ads 
                or behavioral profiling.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-neutral-800">Changes to This Policy</h2>
              <p className="mb-4">
                We may update this policy to reflect improvements or legal changes. If updates are significant, we&apos;ll 
                notify you by email and through the app. The current version is always available in your FamilyHub settings.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-base-300">
              <p className="text-sm text-neutral-600">
                <strong>Last updated:</strong> January 3, 2025
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}