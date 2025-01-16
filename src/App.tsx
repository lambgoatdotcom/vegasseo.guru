import React, { useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link,
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider
} from 'react-router-dom';
import { Mail, Twitter } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import Features from './components/Features';
import { Blog } from './components/Blog';
import logo from './assets/images/seoguru-trans.png';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="blog/*" element={<Blog />} />
    </Route>
  ),
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }
  }
);

function Layout() {
  const [isAsking, setIsAsking] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100 transition-opacity duration-500 ${isAsking ? 'opacity-30' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img src={logo} alt="VegasSEO.guru Logo" className="h-16 w-auto" />
                <span className="ml-3 text-2xl font-bold text-gray-900">VegasSEO.guru</span>
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#about" className="text-gray-600 hover:text-gray-900">About</a>
              <Link to="/blog" className="text-gray-600 hover:text-gray-900">Blog</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Rest of your content */}
      </main>

      {/* Footer */}
      <footer className={`bg-gray-900 text-white py-12 transition-opacity duration-500 ${isAsking ? 'opacity-0' : 'opacity-100'}`}>
        {/* Footer content */}
      </footer>
    </div>
  );
}

function Home() {
  const [isAsking, setIsAsking] = useState(false);
  
  return (
    <main>
      {/* Backdrop for clicking outside chat */}
      {isAsking && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsAsking(false)}
        />
      )}

      {/* Hero Section with integrated chat */}
      <div className="pt-20 p-4 lg:pt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[45%_55%] gap-8 items-center min-h-[calc(100vh-8rem)] py-8">
            {/* Left side - Hero content */}
            <div className={`text-left lg:pr-8 transition-all duration-500 ease-in-out ${isAsking ? 'opacity-0 lg:translate-x-[-100%]' : 'opacity-100 lg:translate-x-0'}`}>
              <div className="flex flex-col items-center lg:items-start">
                <img 
                  src="/src/assets/images/frankie.png" 
                  alt="Las Vegas SEO Guru" 
                  className="w-80 h-80 mb-8 rounded-2xl shadow-lg aspect-square object-cover"
                />
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                  Hey there! I'm Your
                  <span className="text-purple-600"> Vegas SEO </span>
                  Expert
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  Welcome to the main event, champ. If you're done playing small, I've got the winning formula: AI SEO that crushes the competition. Get top-tier intel, pro-level strategy, and real-time data that'll have your site shining brighter than the Strip after dark.
                </p>
                <div className="mt-10 flex items-center gap-x-6">
                  <a href="#features" className="text-lg font-semibold leading-6 text-gray-900 hover:text-purple-600 transition-colors">
                    Learn more <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right side - Chat interface */}
            <div className={`bg-white rounded-xl shadow-xl h-[700px] flex flex-col transition-all duration-500 ease-in-out ${
              isAsking 
                ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] h-[90vh] max-w-5xl z-50' 
                : ''
            }`}>
              <ChatInterface 
                onClose={() => setIsAsking(false)}
                onAskStart={() => setIsAsking(true)}
                isExpanded={isAsking}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`transition-opacity duration-500 ${isAsking ? 'opacity-0' : 'opacity-100'}`}>
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
      </div>
    </main>
  );
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;