import React, { useEffect, useState } from 'react';
import GhostContentAPI from '@tryghost/content-api';

// Initialize the Ghost API client
const api = new GhostContentAPI({
  url: 'http://localhost:2368',
  key: import.meta.env.VITE_GHOST_CONTENT_API_KEY || '',
  version: 'v5.0'
});

interface Post {
  id: string;
  title: string;
  slug: string;
  html: string;
  feature_image: string | null;
  excerpt: string;
  published_at: string;
}

export function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const fetchedPosts = await api.posts.browse({
          limit: 10,
          include: ['tags', 'authors']
        });
        setPosts(fetchedPosts);
      } catch (err) {
        setError('Failed to load blog posts');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-24 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 sm:py-12 sm:pt-24">
      <h1 className="text-4xl font-bold text-gray-900 mb-8">Blog</h1>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            {post.feature_image && (
              <img
                src={post.feature_image}
                alt={post.title}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                <a href={`/blog/${post.slug}`} className="hover:text-purple-600 transition-colors">
                  {post.title}
                </a>
              </h2>
              <p className="text-gray-600 mb-4">{post.excerpt}</p>
              <div className="text-sm text-gray-500">
                {new Date(post.published_at).toLocaleDateString()}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
} 