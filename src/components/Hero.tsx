import React from 'react';
import { Brain, ChevronRight } from 'lucide-react';

interface HeroProps {
  onChatOpen: () => void;
}

function Hero({ onChatOpen }: HeroProps) {
  return (
    <div className="pt-24 pb-16 text-center lg:pt-40 lg:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            I'm Frankie, Your
            <span className="text-purple-600">  Las Vegas </span>
            <br />
            SEO Expert
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Need help with SEO in Vegas? I'll walk you through what actually works here - 
            from local rankings to content that connects with our unique audience.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <button
              onClick={onChatOpen}
              className="rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all duration-200 flex items-center"
            >
              Ask the Guru <ChevronRight className="ml-2 h-5 w-5" />
            </button>
            <a href="#features" className="text-lg font-semibold leading-6 text-gray-900 hover:text-purple-600 transition-colors">
              Learn more <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero;