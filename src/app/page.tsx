"use client";

import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Header from '@/components/Header';
import LoadingButton from '@/components/LoadingButton';

export default function Home() {
  const router = useRouter();

  const handleSignupClick = () => {
    router.push('/signup');
  };

  const handleSigninClick = () => {
    router.push('/auth');
  };

  return (
    <div>
      <Header />
      <main id="main-content" className="min-h-screen bg-gradient-to-b from-secondary/30 via-base-100 to-accent/20" role="main">
        {/* Hero Section with improved contrast */}
        <div className="hero min-h-[85vh]">
          {/* Subtle overlay for better text readability */}
          <div className="hero-overlay bg-base-100/40"></div>
          
          <div className="hero-content text-center">
            <div className="max-w-4xl">
              {/* Logo with tagline */}
              <div className="mb-12 flex justify-center">
                <Logo showTagline={true} />
              </div>
              
              {/* Warmer, more human headline */}
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-neutral-900">
                When family life feels overwhelming,
                <span className="text-primary block mt-2">we help you coordinate.</span>
              </h1>
              
              {/* Supportive subheading */}
              <p className="text-xl md:text-2xl mb-6 text-neutral-700 font-medium">
                Simple tools for families coordinating life across generations.
              </p>
              
              {/* Human-centered supporting text */}
              <p className="text-base md:text-lg mb-10 text-neutral-600 max-w-2xl mx-auto leading-relaxed">
                Whether it&apos;s soccer practice schedules, homework reminders, doctor appointments, or daily check-ins, 
                FamilyHub keeps your whole family connected — from kids to grandparents.
              </p>
              
              {/* Better CTA buttons with clear hierarchy */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <LoadingButton
                  onClick={handleSignupClick}
                  variant="primary"
                  size="lg"
                  className="shadow-lg hover:shadow-xl transition-all text-base-100"
                  aria-label="Start organizing your family's care today - Sign up for FamilyHub"
                >
                  Start Organizing Today
                </LoadingButton>
                <LoadingButton
                  onClick={handleSigninClick}
                  variant="ghost"
                  size="lg"
                  className="border-2 border-accent hover:bg-accent hover:border-accent transition-all"
                  aria-label="Sign in to your existing FamilyHub account"
                >
                  Sign In
                </LoadingButton>
              </div>
              
              {/* Trust indicator */}
              <p className="text-sm text-neutral-600 mt-8">
                No credit card required • Set up in 2 minutes • Always private
              </p>
            </div>
          </div>
        </div>

        {/* Features Section with emotional, family-centered copy */}
        <section id="features" className="py-16" aria-labelledby="features-heading">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 id="features-heading" className="sr-only">Key Features of FamilyHub</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Calendar */}
              <article className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow border border-base-200" role="article" aria-labelledby="calendar-feature">
                <div className="card-body">
                  <div className="text-3xl mb-3" role="img" aria-label="Calendar icon">📅</div>
                  <h3 id="calendar-feature" className="card-title text-xl text-neutral-800 mb-2">
                    Never miss what matters
                  </h3>
                  <p className="text-neutral-600 leading-relaxed">
                    Soccer games, doctor visits, school events, medication schedules — see everything 
                    your family needs in one shared calendar that works for all ages.
                  </p>
                </div>
              </article>
              
              {/* Feature 2: Tasks */}
              <article className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow border border-base-200" role="article" aria-labelledby="tasks-feature">
                <div className="card-body">
                  <div className="text-3xl mb-3" role="img" aria-label="Helping hands icon">🤝</div>
                  <h3 id="tasks-feature" className="card-title text-xl text-neutral-800 mb-2">
                    Share responsibilities, lighten the load
                  </h3>
                  <p className="text-neutral-600 leading-relaxed">
                    &ldquo;Can you pick up the kids?&rdquo; &ldquo;Who&apos;s taking Mom to her appointment?&rdquo; 
                    Coordinate family tasks naturally, so everyone knows their part.
                  </p>
                </div>
              </article>
              
              {/* Feature 3: Documents */}
              <article className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow border border-base-200" role="article" aria-labelledby="documents-feature">
                <div className="card-body">
                  <div className="text-3xl mb-3" role="img" aria-label="Lock icon for security">🔒</div>
                  <h3 id="documents-feature" className="card-title text-xl text-neutral-800 mb-2">
                    Important info, always at hand
                  </h3>
                  <p className="text-neutral-600 leading-relaxed">
                    School forms, insurance cards, emergency contacts, medication lists — 
                    keep all your family&apos;s important information secure and accessible.
                  </p>
                </div>
              </article>
            </div>
            
            {/* Additional supportive message */}
            <div className="text-center mt-16 mb-12">
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                <span className="font-semibold text-primary">Every family is different.</span> Join thousands 
                of families — from single parents to multi-generational households — finding their rhythm with FamilyHub.
              </p>
            </div>
          </div>
        </section>

        {/* Quick benefits section */}
        <section className="bg-base-200/50 py-16 mt-8" aria-labelledby="benefits-heading">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 id="benefits-heading" className="sr-only">Why Choose FamilyHub</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <article>
                <div className="text-2xl mb-2" role="img" aria-label="Shield icon for privacy">🛡️</div>
                <h3 className="font-semibold text-neutral-800 mb-1">Always Private</h3>
                <p className="text-sm text-neutral-600">Your family&apos;s info stays yours</p>
              </article>
              <article>
                <div className="text-2xl mb-2" role="img" aria-label="Green heart icon">💚</div>
                <h3 className="font-semibold text-neutral-800 mb-1">Built with Heart</h3>
                <p className="text-sm text-neutral-600">By families, for families</p>
              </article>
              <article>
                <div className="text-2xl mb-2" role="img" aria-label="Mobile device icon">📱</div>
                <h3 className="font-semibold text-neutral-800 mb-1">Works Everywhere</h3>
                <p className="text-sm text-neutral-600">Phone, tablet, or computer</p>
              </article>
              <article>
                <div className="text-2xl mb-2" role="img" aria-label="Star icon for simplicity">🌟</div>
                <h3 className="font-semibold text-neutral-800 mb-1">Simple by Design</h3>
                <p className="text-sm text-neutral-600">No tech expertise needed</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}