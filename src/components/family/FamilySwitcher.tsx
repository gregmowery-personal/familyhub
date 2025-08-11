'use client';

import { useState, useEffect } from 'react';
import { getUserFamilies, switchDefaultFamily, type Family } from '@/lib/actions/family-actions';

interface FamilySwitcherProps {
  currentFamilyId?: string;
  onFamilySwitch?: (familyId: string) => void;
}

export default function FamilySwitcher({ currentFamilyId, onFamilySwitch }: FamilySwitcherProps) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switchingFamily, setSwitchingFamily] = useState<string | null>(null);

  useEffect(() => {
    loadFamilies();
  }, []);

  const loadFamilies = async () => {
    setLoading(true);
    try {
      const result = await getUserFamilies();
      if (result.success) {
        setFamilies(result.families);
      }
    } catch (error) {
      console.error('Failed to load families:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFamilySwitch = async (familyId: string) => {
    if (familyId === currentFamilyId) {
      setIsOpen(false);
      return;
    }

    setSwitchingFamily(familyId);
    
    try {
      const result = await switchDefaultFamily(familyId);
      
      if (result.success) {
        // Notify parent component of family switch
        onFamilySwitch?.(familyId);
        setIsOpen(false);
        
        // Optionally reload the page to ensure fresh data
        window.location.reload();
      } else {
        console.error('Failed to switch family:', result.error);
      }
    } catch (error) {
      console.error('Error switching family:', error);
    } finally {
      setSwitchingFamily(null);
    }
  };

  const currentFamily = families.find(f => f.id === currentFamilyId);

  if (loading || families.length <= 1) {
    // Don't show switcher if only one family or still loading
    return null;
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 min-w-48"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Family Icon */}
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-9 9a1 1 0 001.414 1.414L3 11.414V18a1 1 0 001 1h12a1 1 0 001-1v-6.586l1.293 1.293a1 1 0 001.414-1.414l-9-9z" />
            </svg>
          </div>

          {/* Family Info */}
          <div className="flex-1 text-left min-w-0">
            <p className="font-medium text-slate-800 truncate">
              {currentFamily?.name || 'Select Family'}
            </p>
            <p className="text-xs text-slate-500">
              {families.length} families available
            </p>
          </div>
        </div>

        {/* Chevron Icon */}
        <svg 
          className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 py-2 max-h-80 overflow-y-auto">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Switch Family
              </p>
            </div>

            <div className="py-2">
              {families.map((family) => {
                const isCurrentFamily = family.id === currentFamilyId;
                const isSwitching = switchingFamily === family.id;
                
                return (
                  <button
                    key={family.id}
                    onClick={() => handleFamilySwitch(family.id)}
                    disabled={isSwitching}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                      isCurrentFamily ? 'bg-emerald-50 hover:bg-emerald-50' : ''
                    } ${isSwitching ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {/* Family Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrentFamily 
                        ? 'bg-gradient-to-br from-emerald-200 to-emerald-100' 
                        : 'bg-gradient-to-br from-slate-100 to-slate-50'
                    }`}>
                      {isSwitching ? (
                        <svg className="w-4 h-4 text-slate-500 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className={`text-sm font-semibold ${
                          isCurrentFamily ? 'text-emerald-700' : 'text-slate-600'
                        }`}>
                          {family.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Family Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-medium truncate ${
                          isCurrentFamily ? 'text-emerald-800' : 'text-slate-800'
                        }`}>
                          {family.name}
                        </p>
                        {isCurrentFamily && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-full font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                          </svg>
                          {family.member_count || 0} members
                        </span>
                        
                        {family.subscription_tier && (
                          <span className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                            {family.subscription_tier.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Checkmark for current family */}
                    {isCurrentFamily && (
                      <div className="flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create New Family Option */}
            <div className="border-t border-slate-100 pt-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to create family page
                  window.location.href = '/families/create';
                }}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-emerald-600 hover:text-emerald-700"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Create New Family</p>
                  <p className="text-xs text-emerald-500">Set up another family group</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}