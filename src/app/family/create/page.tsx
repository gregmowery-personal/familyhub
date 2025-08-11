'use client';

import CreateFamilyWizard from '@/components/family/CreateFamilyWizard';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function CreateFamilyPage() {
  return (
    <ProtectedRoute requireEmailVerification={true}>
      <CreateFamilyWizard />
    </ProtectedRoute>
  );
}