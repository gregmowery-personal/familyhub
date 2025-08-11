/**
 * Prototype Email Service for Development
 * 
 * This is a placeholder email service until we decide on an email provider.
 * In development, it logs emails to the console.
 * In production, this should be replaced with a real email service (SendGrid, Resend, etc.)
 */

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface VerificationEmailData {
  email: string;
  name?: string;
  verificationUrl: string;
}

interface VerificationCodeData {
  email: string;
  name?: string;
  code: string;
}

interface WelcomeEmailData {
  email: string;
  name?: string;
  dashboardUrl: string;
}

class PrototypeEmailService {
  /**
   * Send simple verification code email
   */
  async sendVerificationCode(data: VerificationCodeData): Promise<boolean> {
    const template: EmailTemplate = {
      to: data.email,
      subject: 'Your FamilyHub verification code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #87A89A 0%, #9B98B0 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; text-align: center; }
              .code-box { background: #f3f4f6; border: 2px solid #87A89A; border-radius: 12px; padding: 24px; margin: 24px 0; }
              .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937; font-family: monospace; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">Welcome to FamilyHub! 🌟</h1>
              </div>
              <div class="content">
                <p style="font-size: 18px; color: #4b5563;">Hi ${data.name || 'there'},</p>
                <p style="font-size: 16px; color: #6b7280;">Enter this code to verify your email:</p>
                
                <div class="code-box">
                  <div class="code">${data.code}</div>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                  This code expires in 15 minutes for your security.
                </p>
                
                <div class="footer">
                  <p>Need help? Just reply to this email.</p>
                  <p>— The FamilyHub Team</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to FamilyHub!

Hi ${data.name || 'there'},

Your verification code is: ${data.code}

This code expires in 15 minutes.

Need help? Reply to this email.

— The FamilyHub Team
      `
    };

    return this.sendEmail(template);
  }

  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Send verification email
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<boolean> {
    const template: EmailTemplate = {
      to: data.email,
      subject: 'Verify your FamilyHub email',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #87A89A 0%, #9B98B0 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; }
              .button { display: inline-block; padding: 14px 32px; background: #87A89A; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">Welcome to FamilyHub! 🏠</h1>
              </div>
              <div class="content">
                <p>Hi ${data.name || 'there'},</p>
                <p>Thanks for signing up for FamilyHub! We're excited to help you coordinate with your family.</p>
                <p>Please verify your email address by clicking the button below:</p>
                <div style="text-align: center;">
                  <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${data.verificationUrl}</p>
                <p>This link will expire in 24 hours for security reasons.</p>
                <div class="footer">
                  <p>Need help? Reply to this email and we'll be happy to assist.</p>
                  <p>— The FamilyHub Team</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
Welcome to FamilyHub!

Hi ${data.name || 'there'},

Thanks for signing up for FamilyHub! Please verify your email address by clicking the link below:

${data.verificationUrl}

This link will expire in 24 hours for security reasons.

Need help? Reply to this email and we'll be happy to assist.

— The FamilyHub Team
      `
    };

    return this.sendEmail(template);
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const template: EmailTemplate = {
      to: data.email,
      subject: 'Welcome to FamilyHub - Let\'s Get Started!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #87A89A 0%, #9B98B0 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; }
              .button { display: inline-block; padding: 14px 32px; background: #87A89A; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }
              .step { display: flex; align-items: flex-start; margin: 20px 0; }
              .step-number { background: #87A89A; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; flex-shrink: 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">You're All Set! 🎉</h1>
              </div>
              <div class="content">
                <p>Hi ${data.name || 'there'},</p>
                <p>Your email is verified and your FamilyHub account is ready to go!</p>
                
                <h3>Here's how to get started:</h3>
                
                <div class="step">
                  <div class="step-number">1</div>
                  <div>
                    <strong>Create Your Family</strong><br>
                    Set up your first family group with a name and timezone
                  </div>
                </div>
                
                <div class="step">
                  <div class="step-number">2</div>
                  <div>
                    <strong>Invite Family Members</strong><br>
                    Add your loved ones, caregivers, and trusted contacts
                  </div>
                </div>
                
                <div class="step">
                  <div class="step-number">3</div>
                  <div>
                    <strong>Start Coordinating</strong><br>
                    Share calendars, tasks, and important information
                  </div>
                </div>
                
                <div style="text-align: center;">
                  <a href="${data.dashboardUrl}" class="button">Go to Your Dashboard</a>
                </div>
                
                <div class="footer">
                  <p><strong>🔒 Your Privacy Matters</strong></p>
                  <p>Your family's information is private and secure. We never share your data.</p>
                  <p>— The FamilyHub Team</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
You're All Set!

Hi ${data.name || 'there'},

Your email is verified and your FamilyHub account is ready to go!

Here's how to get started:

1. Create Your Family
   Set up your first family group with a name and timezone

2. Invite Family Members
   Add your loved ones, caregivers, and trusted contacts

3. Start Coordinating
   Share calendars, tasks, and important information

Go to your dashboard: ${data.dashboardUrl}

Your Privacy Matters
Your family's information is private and secure. We never share your data.

— The FamilyHub Team
      `
    };

    return this.sendEmail(template);
  }

  /**
   * Core email sending function
   */
  private async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      if (this.isDevelopment) {
        // In development, log to console
        console.log('📧 [PROTOTYPE EMAIL SERVICE]');
        console.log('================================');
        console.log(`To: ${template.to}`);
        console.log(`Subject: ${template.subject}`);
        console.log('--------------------------------');
        if (template.text) {
          console.log('Text Version:');
          console.log(template.text);
        }
        console.log('--------------------------------');
        console.log('✅ Email logged (development mode)');
        console.log('================================\n');
        
        // Store in localStorage for testing (browser only)
        if (typeof window !== 'undefined') {
          const emails = JSON.parse(localStorage.getItem('prototype_emails') || '[]');
          emails.push({
            ...template,
            sentAt: new Date().toISOString()
          });
          localStorage.setItem('prototype_emails', JSON.stringify(emails));
        }
        
        return true;
      } else {
        // In production, this should integrate with a real email service
        console.warn('⚠️ Email service not configured for production');
        console.log('Would send email to:', template.to);
        
        // TODO: Integrate with real email service
        // Examples:
        // - SendGrid: await sendgrid.send(template)
        // - Resend: await resend.send(template)
        // - AWS SES: await ses.sendEmail(template)
        
        return false;
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Get logged emails (development only)
   */
  getLoggedEmails(): any[] {
    if (typeof window !== 'undefined' && this.isDevelopment) {
      return JSON.parse(localStorage.getItem('prototype_emails') || '[]');
    }
    return [];
  }

  /**
   * Clear logged emails (development only)
   */
  clearLoggedEmails(): void {
    if (typeof window !== 'undefined' && this.isDevelopment) {
      localStorage.removeItem('prototype_emails');
    }
  }
}

// Export singleton instance
export const emailService = new PrototypeEmailService();

// Export types for use in other files
export type { EmailTemplate, VerificationEmailData, VerificationCodeData, WelcomeEmailData };