'use client';

import React from 'react';

interface TierFeature {
  name: string;
  included: boolean;
  highlight?: boolean;
}

interface MembershipTier {
  id: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  iconEmoji: string;
  borderColor: string;
  bgGradient: string;
  buttonStyle: string;
  buttonHover: string;
  current?: boolean;
  popular?: boolean;
  features: TierFeature[];
  cta: string;
}

const tiers: MembershipTier[] = [
  {
    id: 'free',
    name: 'Family Start',
    tagline: 'Perfect for getting your family organized',
    price: 'Free',
    period: 'always',
    iconEmoji: '💚',
    borderColor: 'border-emerald-200',
    bgGradient: 'bg-gradient-to-br from-emerald-50 to-white',
    buttonStyle: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    buttonHover: 'hover:bg-emerald-200',
    current: true,
    features: [
      { name: 'Shared family calendar', included: true },
      { name: 'Basic task assignments', included: true },
      { name: 'Daily check-in prompts', included: true },
      { name: 'Contact book (up to 25)', included: true },
      { name: 'Document storage (100MB)', included: true },
      { name: 'Up to 4 family members', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Email support', included: true },
      { name: 'Advanced scheduling', included: false },
      { name: 'Medication reminders', included: false },
      { name: 'Care provider coordination', included: false },
      { name: 'Priority support', included: false }
    ],
    cta: 'Current Plan'
  },
  {
    id: 'family',
    name: 'Family Care',
    tagline: 'Enhanced coordination for busy families',
    price: '$12',
    period: 'per month',
    iconEmoji: '👨‍👩‍👧‍👦',
    borderColor: 'border-purple-200',
    bgGradient: 'bg-gradient-to-br from-purple-50 to-white',
    buttonStyle: 'bg-purple-600 text-white',
    buttonHover: 'hover:bg-purple-700',
    popular: true,
    features: [
      { name: 'Everything in Family Start', included: true },
      { name: 'Advanced scheduling & recurring events', included: true, highlight: true },
      { name: 'Medication & appointment reminders', included: true, highlight: true },
      { name: 'Unlimited contacts & groups', included: true, highlight: true },
      { name: 'Document storage (5GB)', included: true },
      { name: 'Up to 8 family members', included: true },
      { name: 'Photo sharing & memories', included: true, highlight: true },
      { name: 'Care provider coordination tools', included: true, highlight: true },
      { name: 'Priority email & chat support', included: true },
      { name: 'Family insights & reports', included: false },
      { name: 'Multi-generation roles', included: false },
      { name: 'Advanced privacy controls', included: false }
    ],
    cta: 'Upgrade to Family Care'
  },
  {
    id: 'premium',
    name: 'Family Legacy',
    tagline: 'Complete coordination across generations',
    price: '$24',
    period: 'per month',
    iconEmoji: '👑',
    borderColor: 'border-amber-200',
    bgGradient: 'bg-gradient-to-br from-amber-50 to-white',
    buttonStyle: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white',
    buttonHover: 'hover:from-amber-700 hover:to-orange-700',
    features: [
      { name: 'Everything in Family Care', included: true },
      { name: 'Unlimited family members', included: true, highlight: true },
      { name: 'Multi-generation role management', included: true, highlight: true },
      { name: 'Advanced privacy & access controls', included: true, highlight: true },
      { name: 'Family insights & health trends', included: true, highlight: true },
      { name: 'Unlimited document storage', included: true },
      { name: 'Emergency contact automation', included: true, highlight: true },
      { name: 'Legacy planning tools', included: true, highlight: true },
      { name: 'Concierge support (phone + video)', included: true, highlight: true },
      { name: 'Custom family workflows', included: true, highlight: true },
      { name: 'Integration with health providers', included: true, highlight: true },
      { name: 'Advanced security features', included: true, highlight: true }
    ],
    cta: 'Upgrade to Family Legacy'
  }
];

const MembershipTiers: React.FC = () => {
  const handleUpgrade = (tierId: string) => {
    // TODO: Implement upgrade flow
    console.log(`Upgrading to ${tierId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="flex justify-center mb-4">
          <span className="text-4xl">✨</span>
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Choose Your Family&apos;s Plan
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          From getting started to comprehensive multi-generational coordination, 
          we have the right plan to help your family stay connected and organized.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="bg-emerald-100 px-4 py-2 rounded-full flex items-center gap-2">
            <span className="text-emerald-600">🛡️</span>
            <span className="text-emerald-800 font-medium">30-day money-back guarantee</span>
          </div>
        </div>
      </div>

      {/* Tiers Grid */}
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`
              relative rounded-3xl border-2 transition-all duration-300 hover:shadow-xl
              ${tier.borderColor} ${tier.bgGradient}
              ${tier.popular ? 'scale-105 shadow-lg' : ''}
              ${tier.current ? 'ring-4 ring-emerald-200' : ''}
            `}
          >
            {/* Popular Badge */}
            {tier.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                  Most Popular
                </div>
              </div>
            )}

            {/* Current Plan Badge */}
            {tier.current && (
              <div className="absolute -top-4 right-6 z-10">
                <div className="bg-emerald-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2">
                  <span>✓</span>
                  Current Plan
                </div>
              </div>
            )}

            <div className="p-8">
              {/* Tier Header */}
              <div className="text-center mb-8">
                <div className="mb-4">
                  <span className="text-5xl">{tier.iconEmoji}</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {tier.name}
                </h3>
                <p className="text-gray-600 mb-6">
                  {tier.tagline}
                </p>
                
                {/* Pricing */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {tier.price}
                    </span>
                    {tier.period !== 'always' && (
                      <span className="text-gray-600">
                        {tier.period}
                      </span>
                    )}
                  </div>
                  {tier.id === 'family' && (
                    <p className="text-sm text-gray-500 mt-1">
                      Save $24 with annual billing
                    </p>
                  )}
                  {tier.id === 'premium' && (
                    <p className="text-sm text-gray-500 mt-1">
                      Save $48 with annual billing
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={tier.current}
                  className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300
                    ${tier.buttonStyle} ${tier.buttonHover}
                    ${tier.current ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 shadow-lg'}
                    focus:outline-none focus:ring-4 focus:ring-opacity-50
                    ${tier.id === 'free' ? 'focus:ring-emerald-200' : 
                      tier.id === 'family' ? 'focus:ring-purple-200' : 'focus:ring-amber-200'}
                  `}
                >
                  {tier.cta}
                </button>
              </div>

              {/* Features List */}
              <div className="space-y-4">
                {tier.features.map((feature, featureIndex) => (
                  <div
                    key={featureIndex}
                    className={`
                      flex items-start gap-3 transition-all duration-300
                      ${feature.highlight ? 'bg-white/60 -mx-2 px-2 py-1 rounded-lg' : ''}
                    `}
                  >
                    {feature.included ? (
                      <span className={`
                        mt-0.5 flex-shrink-0
                        ${feature.highlight ? 'text-green-600' : 'text-gray-400'}
                      `}>
                        ✓
                      </span>
                    ) : (
                      <span className="mt-0.5 flex-shrink-0 text-gray-300">○</span>
                    )}
                    <span 
                      className={`
                        text-sm leading-relaxed
                        ${feature.included ? 'text-gray-900' : 'text-gray-400'}
                        ${feature.highlight ? 'font-medium' : ''}
                      `}
                    >
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-16 text-center">
        <div className="bg-gradient-to-r from-emerald-50 to-purple-50 rounded-3xl p-8 max-w-4xl mx-auto">
          <div className="flex justify-center mb-4">
            <span className="text-4xl">⏰</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to bring your family closer together?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Join thousands of families who trust FamilyHub to keep everyone connected, 
            organized, and caring for each other across all generations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleUpgrade('family')}
              className="bg-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-purple-700 transition-all duration-300 hover:scale-105 shadow-lg focus:outline-none focus:ring-4 focus:ring-purple-200"
            >
              Start Your 30-Day Free Trial
            </button>
            <button className="text-emerald-600 px-8 py-4 rounded-xl font-semibold hover:bg-emerald-50 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-200">
              Schedule a Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipTiers;