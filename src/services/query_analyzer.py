from pydantic import BaseModel, Field
from typing import List, Optional
import re

class QueryAnalysis(BaseModel):
    needs_search: bool
    search_query: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

class QueryAnalyzer:
    def __init__(self):
        # Keywords that suggest factual or current information is needed
        self.search_triggers = {
            'statistics': 0.9,
            'latest': 0.9,
            'current': 0.9,
            'recent': 0.9,
            'trends': 0.9,
            'news': 0.9,
            'data': 0.8,
            'research': 0.8,
            'study': 0.8,
            'example': 0.7,
            'competitor': 0.8,
            'competitors': 0.8,
            'business': 0.7,
            'website': 0.7,
            'company': 0.7,
            'companies': 0.7,
            'market': 0.7,
            'industry': 0.7,
        }
        
        # Patterns that suggest search might be needed
        self.search_patterns = [
            (r'what.*(?:is|are).*(?:the best|the top|the most)', 0.8),  # "What are the best SEO practices"
            (r'how.*(?:does|do).*(?:company|competitor|business)', 0.8),  # "How does Company X do their SEO"
            (r'(?:find|show|give).*example', 0.7),  # "Give me examples of"
            (r'compare.*(?:with|to)', 0.8),  # "Compare X with Y"
            (r'(?:in|for)\s+\d{4}', 0.9),  # References to specific years
            (r'(?:latest|current|recent).*(?:trend|development|change)', 0.9),  # Latest trends/developments
        ]

    def analyze(self, query: str) -> QueryAnalysis:
        query_lower = query.lower()
        max_confidence = 0.0
        reasons = []
        
        # Check for trigger words
        for trigger, confidence in self.search_triggers.items():
            if trigger in query_lower:
                max_confidence = max(max_confidence, confidence)
                reasons.append(f"Contains keyword '{trigger}'")
        
        # Check for patterns
        for pattern, confidence in self.search_patterns:
            if re.search(pattern, query_lower):
                max_confidence = max(max_confidence, confidence)
                reasons.append(f"Matches pattern for specific information request")
        
        # Determine if search is needed based on confidence threshold
        needs_search = max_confidence >= 0.7
        
        # Create search query if needed
        search_query = None
        if needs_search:
            # Extract key terms for search
            # Remove common words and create focused search query
            stop_words = {'what', 'is', 'are', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or'}
            terms = [word for word in query_lower.split() if word not in stop_words]
            search_query = ' '.join(terms) + ' Las Vegas SEO'  # Add domain context
        
        return QueryAnalysis(
            needs_search=needs_search,
            search_query=search_query,
            confidence=max_confidence,
            reasoning='; '.join(reasons) if reasons else "No search triggers found"
        ) 