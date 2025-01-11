from typing import Optional, List
from pydantic import BaseModel
import aiohttp
from bs4 import BeautifulSoup
import asyncio
from urllib.parse import urlparse
import re

class ScrapedContent(BaseModel):
    url: str
    title: str
    content: str
    domain: str
    content_length: int

class ContentScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self._last_request_time = 0
        self._min_request_interval = 0.5  # Half second between requests
        self.max_content_length = 5000  # Increased from 1000 to 5000 characters
    
    async def _wait_for_rate_limit(self):
        current_time = asyncio.get_event_loop().time()
        time_since_last_request = current_time - self._last_request_time
        if time_since_last_request < self._min_request_interval:
            await asyncio.sleep(self._min_request_interval - time_since_last_request)
        self._last_request_time = asyncio.get_event_loop().time()

    def _clean_text(self, text: str) -> str:
        """Clean extracted text by removing extra whitespace and unwanted characters"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters
        text = re.sub(r'[^\w\s.,!?-]', '', text)
        return text.strip()

    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extract main content from the page while avoiding navigation, headers, footers, etc."""
        # Remove unwanted elements
        unwanted_elements = [
            'nav', 'header', 'footer', 'script', 'style', 'iframe', 
            'noscript', 'aside', 'form', 'button', 'input', 'meta',
            'svg', 'path', 'symbol', 'img', 'picture', 'video'
        ]
        for element in soup.find_all(unwanted_elements):
            element.decompose()
        
        # Remove common ad and popup selectors
        ad_selectors = [
            '[class*="ad-"]', '[class*="advertisement"]', '[class*="popup"]',
            '[id*="ad-"]', '[id*="advertisement"]', '[id*="popup"]',
            '[class*="cookie"]', '[class*="newsletter"]', '[class*="sidebar"]'
        ]
        for selector in ad_selectors:
            for element in soup.select(selector):
                element.decompose()

        # Try to find main content area using common content selectors
        main_content = None
        content_selectors = [
            'main',
            'article',
            '[role="main"]',
            '[role="article"]',
            '.content',
            '.post-content',
            '.article-content',
            '.entry-content',
            '#content',
            '.post',
            '.article',
            '.blog-post',
            '[class*="content"]',  # Broader content class match
            'div.container'  # Common container class
        ]
        
        for selector in content_selectors:
            main_content = soup.select_one(selector)
            if main_content and len(main_content.get_text(strip=True)) > 200:  # Ensure it has substantial content
                break
        
        # If no main content found, try the body
        if not main_content or len(main_content.get_text(strip=True)) < 200:
            main_content = soup.find('body')
        
        if not main_content:
            return ""
        
        # Extract content with structure preservation
        content_parts = []
        
        # Get headings first
        headings = main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        for heading in headings:
            heading_text = heading.get_text(strip=True)
            if heading_text:
                content_parts.append(f"\n{heading_text}\n")
        
        # Get paragraphs and lists
        for element in main_content.find_all(['p', 'ul', 'ol']):
            if element.name in ['ul', 'ol']:
                # Handle lists
                list_items = element.find_all('li')
                for item in list_items:
                    item_text = item.get_text(strip=True)
                    if item_text:
                        content_parts.append(f"• {item_text}")
            else:
                # Handle paragraphs
                para_text = element.get_text(strip=True)
                if para_text:
                    content_parts.append(para_text)
        
        # Join all parts with appropriate spacing
        content = '\n'.join(content_parts)
        
        # Clean the text while preserving structure
        content = re.sub(r'\s+', ' ', content)  # Normalize whitespace
        content = re.sub(r'\n\s*\n', '\n\n', content)  # Normalize paragraph breaks
        content = re.sub(r'[^\w\s.,!?;:()\-•\n]', '', content)  # Remove special chars while keeping basic punctuation
        
        return content.strip()

    async def scrape_url(self, url: str) -> Optional[ScrapedContent]:
        """Scrape content from a single URL"""
        await self._wait_for_rate_limit()
        
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(url, timeout=10) as response:
                    if response.status != 200:
                        return None
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Get title
                    title = soup.title.string if soup.title else ""
                    title = self._clean_text(title)
                    
                    # Get main content
                    content = self._extract_main_content(soup)
                    full_length = len(content)
                    
                    # Limit content length while preserving complete sentences
                    if len(content) > self.max_content_length:
                        # Find the last period before max_content_length
                        last_period = content[:self.max_content_length].rfind('.')
                        if last_period > 0:
                            content = content[:last_period + 1]
                    
                    # Get domain
                    domain = urlparse(url).netloc
                    
                    return ScrapedContent(
                        url=url,
                        title=title,
                        content=content,
                        domain=domain,
                        content_length=full_length
                    )
        except Exception as e:
            print(f"Error scraping {url}: {str(e)}")
            return None

    async def scrape_search_results(self, urls: List[str], max_results: int = 3) -> List[ScrapedContent]:
        """Scrape content from multiple URLs concurrently"""
        tasks = []
        for url in urls[:max_results]:  # Limit number of URLs to scrape
            tasks.append(self.scrape_url(url))
        
        results = await asyncio.gather(*tasks)
        return [r for r in results if r is not None]

    def format_scraped_content(self, contents: List[ScrapedContent]) -> str:
        """Format scraped content into a string suitable for AI context"""
        if not contents:
            return "No content could be scraped from the search results."
        
        context = "Here is relevant content from the top search results:\n\n"
        
        for idx, content in enumerate(contents, 1):
            context += f"Source {idx}: {content.title} ({content.domain})\n"
            context += f"Content: {content.content}\n"
            context += f"URL: {content.url}\n\n"
        
        return context 