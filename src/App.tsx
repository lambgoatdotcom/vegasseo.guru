import React, { useState } from 'react';
import { MessageSquare, Search, BarChart, Mail, Twitter, Brain } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import Features from './components/Features';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-purple-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">VegasSEO.guru</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900">About</a>
              <a href="#blog" className="text-gray-600 hover:text-gray-900">Blog</a>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section with integrated chat */}
        <div className="pt-16 lg:pt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center min-h-[calc(100vh-4rem)]">
              {/* Left side - Hero content */}
              <div className="text-left lg:pr-8">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                  Your AI-Powered
                  <span className="text-purple-600"> SEO Guru</span>
                  <br />
                  for Las Vegas
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Unlock the secrets of Las Vegas SEO with our AI expert. Get instant answers, 
                  content suggestions, and marketing strategies tailored for the Vegas market.
                </p>
                <div className="mt-10 flex items-center gap-x-6">
                  <a href="#features" className="text-lg font-semibold leading-6 text-gray-900 hover:text-purple-600 transition-colors">
                    Learn more <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
              
              {/* Right side - Chat interface */}
              <div className="bg-white rounded-xl shadow-xl h-[600px] flex flex-col">
                <ChatInterface onClose={() => {}} />
              </div>
            </div>
          </div>
        </div>

        <Features />
        
        {/* Testimonials */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12">Trusted by SEO Professionals</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm">
                  <p className="text-gray-600 mb-4">
                    "The AI Guru has transformed how we approach SEO in Las Vegas. It's like having an expert consultant available 24/7."
                  </p>
                  <div className="flex items-center">
                    <img
                      src={`https://images.unsplash.com/photo-${i === 1 ? '1472099645785-5658abf4ff4e' : i === 2 ? '1494790108377-be9c29b29330' : '1438761681033-6461ffad8d80'}?auto=format&fit=crop&w=50&h=50&q=80`}
                      alt="Testimonial avatar"
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="ml-3">
                      <p className="font-semibold">John Doe</p>
                      <p className="text-sm text-gray-500">SEO Director</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center">
                <Brain className="h-8 w-8 text-purple-400" />
                <span className="ml-2 text-xl font-bold">VegasSEO.guru</span>
              </div>
              <p className="mt-4 text-gray-400">Your AI-powered SEO companion for dominating Las Vegas search results.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#about" className="hover:text-white">About</a></li>
                <li><a href="#blog" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400">
                <li>contact@vegasseo.guru</li>
                <li>Las Vegas, NV</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Follow Us</h3>
              <div className="flex space-x-4">
                <Twitter className="h-6 w-6 text-gray-400 hover:text-white cursor-pointer" />
                <Mail className="h-6 w-6 text-gray-400 hover:text-white cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} VegasSEO.guru. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;