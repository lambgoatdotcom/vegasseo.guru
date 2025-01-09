import React from 'react';
import { MessageSquare, Search, BarChart, Mail } from 'lucide-react';

function Features() {
  const features = [
    {
      icon: <MessageSquare className="h-6 w-6 text-purple-600" />,
      title: "24/7 SEO Consultation",
      description: "Get instant answers to your SEO questions anytime, anywhere. Our AI guru never sleeps."
    },
    {
      icon: <Search className="h-6 w-6 text-purple-600" />,
      title: "Local SEO Expertise",
      description: "Specialized knowledge in Las Vegas market dynamics and search patterns."
    },
    {
      icon: <BarChart className="h-6 w-6 text-purple-600" />,
      title: "Strategy Analysis",
      description: "Real-time analysis of your SEO strategy with actionable recommendations."
    },
    {
      icon: <Mail className="h-6 w-6 text-purple-600" />,
      title: "Content Generation",
      description: "AI-powered content suggestions optimized for Las Vegas keywords."
    }
  ];

  return (
    <section id="features" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything You Need for Vegas SEO Success
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Powered by advanced AI to give you the edge in Las Vegas search rankings
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div key={index} className="relative">
              <div className="absolute left-0 top-0 -z-10 h-24 w-24 rounded-full bg-purple-100 opacity-25"></div>
              <div className="flow-root rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center rounded-xl bg-white p-3 shadow-lg">
                    {feature.icon}
                  </div>
                  <h3 className="mt-8 text-lg font-semibold leading-8 tracking-tight text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-5 text-base leading-7 text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;