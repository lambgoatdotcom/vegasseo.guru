import asyncio
import json
from .brave_search import BraveSearchTool
from .query_analyzer import QueryAnalyzer

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

    for query in test_queries:
        print("\n" + "="*50)
        print(f"Testing query: {query}")
        
        # Analyze the query
        analysis = analyzer.analyze(query)
        print(f"\nAnalysis Results:")
        print(f"Needs Search: {analysis.needs_search}")
        print(f"Confidence: {analysis.confidence}")
        print(f"Reasoning: {analysis.reasoning}")
        
        # If search is needed, perform search
        if analysis.needs_search and analysis.search_query:
            print(f"\nPerforming search with query: {analysis.search_query}")
            try:
                results = await search_tool.search(analysis.search_query)
                context = search_tool.format_results_for_context(results)
                print("\nSearch Results:")
                print(context)
            except Exception as e:
                print(f"Search error: {str(e)}")
        else:
            print("\nNo search needed for this query")

if __name__ == "__main__":
    asyncio.run(test_search_and_analysis()) 