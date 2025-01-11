from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import aiohttp
import json
import asyncio

class BraveSearchResult(BaseModel):
    title: str
    link: str
    description: Optional[str] = None
    snippet: Optional[str] = None

class BraveSearchQuery(BaseModel):
    original: str
    
class BraveSearchResponse(BaseModel):
    query: BraveSearchQuery
    web: Dict[str, Any]
    
    @property
    def results(self) -> List[BraveSearchResult]:
        web_results = self.web.get('results', [])
        return [
            BraveSearchResult(
                title=result.get('title', ''),
                link=result.get('url', ''),
                description=result.get('description'),
                snippet=result.get('description')  # Brave uses description as snippet
            )
            for result in web_results
        ]
    
    @property
    def total_count(self) -> int:
        return self.web.get('total', 0)

class BraveSearchTool:
    def __init__(self, api_key: str = "BSA9ju8rWHoSYkOU0FdxGDrX0xolfdd"):
        self.api_key = api_key
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
        self.headers = {
            "Accept": "application/json",
            "X-Subscription-Token": api_key
        }
        self._last_request_time = 0
        self._min_request_interval = 1.0  # Minimum time between requests in seconds
    
    async def _wait_for_rate_limit(self):
        """Ensure we don't exceed rate limits"""
        current_time = asyncio.get_event_loop().time()
        time_since_last_request = current_time - self._last_request_time
        if time_since_last_request < self._min_request_interval:
            await asyncio.sleep(self._min_request_interval - time_since_last_request)
        self._last_request_time = asyncio.get_event_loop().time()
    
    async def search(self, query: str, count: int = 5) -> BraveSearchResponse:
        """
        Perform a search using Brave Search API and return structured results
        """
        await self._wait_for_rate_limit()
        
        params = {
            "q": query,
            "count": count,
            "search_lang": "en",
            "safesearch": "moderate"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                self.base_url,
                headers=self.headers,
                params=params
            ) as response:
                if response.status == 429:
                    print("Rate limited. Waiting before retry...")
                    await asyncio.sleep(2)  # Wait 2 seconds before retry
                    return await self.search(query, count)  # Retry the request
                
                if response.status != 200:
                    raise Exception(f"Brave Search API error: {response.status}")
                
                data = await response.json()
                return BraveSearchResponse(**data)

    def format_results_for_context(self, results: BraveSearchResponse) -> str:
        """
        Format search results into a string suitable for AI context
        """
        context = "Here are some relevant sources:\n\n"
        
        for idx, result in enumerate(results.results, 1):
            context += f"{idx}. {result.title}\n"
            if result.snippet:
                context += f"   Summary: {result.snippet}\n"
            context += f"   URL: {result.link}\n\n"
        
        return context

# Example usage:
# async def main():
#     search_tool = BraveSearchTool()
#     results = await search_tool.search("Las Vegas SEO strategies")
#     context = search_tool.format_results_for_context(results)
#     print(context) 