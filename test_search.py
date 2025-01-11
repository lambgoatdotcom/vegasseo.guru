import asyncio
from src.services.brave_search import BraveSearchTool
from src.services.query_analyzer import QueryAnalyzer
from src.services.content_scraper import ContentScraper

async def test_search_and_analysis():
    # Test cases with different types of queries
    test_queries = [
        "What are the latest SEO trends in Las Vegas?",
        "How do I optimize my meta tags?",  # Should not trigger search
        "Show me examples of successful Las Vegas businesses",
        "What are the statistics for keyword rankings?",
        "Tell me about competitor websites in Las Vegas",
    ]

    search_tool = BraveSearchTool()
    analyzer = QueryAnalyzer()
    scraper = ContentScraper()

    for query in test_queries:
        print("\n" + "="*50)
        print(f"Testing query: {query}")
        
        try:
            # Analyze the query
            analysis = analyzer.analyze(query)
            print(f"\nAnalysis Results:")
            print(f"Needs Search: {analysis.needs_search}")
            print(f"Confidence: {analysis.confidence}")
            print(f"Reasoning: {analysis.reasoning}")
            
            if analysis.search_query:
                print(f"Generated search query: {analysis.search_query}")
            
            # If search is needed, perform search and scrape content
            if analysis.needs_search and analysis.search_query:
                print(f"\nPerforming search with query: {analysis.search_query}")
                try:
                    # Get search results
                    results = await search_tool.search(analysis.search_query)
                    
                    if results.results:
                        print("\nSearch Results:")
                        for idx, result in enumerate(results.results, 1):
                            print(f"\n{idx}. {result.title}")
                            if result.snippet:
                                print(f"   Summary: {result.snippet}")
                            print(f"   URL: {result.link}")
                        
                        # Scrape content from search results
                        print("\nScraping content from top results...")
                        urls = [result.link for result in results.results]
                        scraped_contents = await scraper.scrape_search_results(urls)
                        
                        if scraped_contents:
                            print("\nScraped Content:")
                            for content in scraped_contents:
                                print(f"\nFrom {content.domain}:")
                                print(f"Title: {content.title}")
                                print(f"Total content length: {content.content_length} characters")
                                print(f"Content:")
                                print("-" * 50)
                                print(content.content)
                                print("-" * 50)
                                print(f"URL: {content.url}\n")
                        else:
                            print("\nNo content could be scraped from the results.")
                    else:
                        print("No results found")
                except Exception as e:
                    print(f"Search/Scrape error: {str(e)}")
            else:
                print("\nNo search needed for this query")
            
            # Add a small delay between tests
            await asyncio.sleep(1)
            
        except Exception as e:
            print(f"Error processing query: {str(e)}")
            continue

if __name__ == "__main__":
    asyncio.run(test_search_and_analysis()) 