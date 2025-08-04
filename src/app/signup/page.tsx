import React from 'react';
import { Metadata } from 'next';
import SignupPageRedesign from '@/components/SignupPageRedesign';

export const metadata: Metadata = {
  title: 'Sign Up | FamilyHub - Create Your Family Account',
  description: 'Join FamilyHub to start organizing your family\'s schedules, tasks, and important information. Secure, private, and easy to use for all generations.',
  keywords: 'family signup, create account, family organization, family app registration',
  openGraph: {
    title: 'Join FamilyHub - Start Organizing Your Family Today',
    description: 'Create your free FamilyHub account and bring your family\'s coordination to one secure place.',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignupPageRoute() {
  return <SignupPageRedesign />;
}