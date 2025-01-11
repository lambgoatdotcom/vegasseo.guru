from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import re
from textblob import TextBlob

class ContentMetrics(BaseModel):
    word_count: int
    keyword_density: Dict[str, float]
    readability_score: float
    sentiment_score: float
    heading_structure: Dict[str, int]
    meta_description_length: Optional[int]
    title_length: Optional[int]
    content_issues: List[str]
    improvement_suggestions: List[str]

class ContentAnalysisConfig(BaseModel):
    min_word_count: int = 300
    max_keyword_density: float = 2.5
    target_readability_score: float = 60.0
    important_keywords: List[str] = Field(default_factory=list)
    check_meta_description: bool = True
    check_title: bool = True

class ContentAnalysisAgent(BaseModel):
    config: ContentAnalysisConfig = Field(default_factory=ContentAnalysisConfig)
    
    def calculate_readability(self, text: str) -> float:
        """Calculate Flesch Reading Ease score"""
        if not text:
            return 0.0
            
        sentences = len(re.split(r'[.!?]+', text))
        words = len(text.split())
        syllables = sum([self._count_syllables(word) for word in text.split()])
        
        if sentences == 0 or words == 0:
            return 0.0
            
        return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)

    def _count_syllables(self, word: str) -> int:
        """Count syllables in a word"""
        word = word.lower()
        count = 0
        vowels = "aeiouy"
        on_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not on_vowel:
                count += 1
            on_vowel = is_vowel
            
        if word.endswith('e'):
            count -= 1
        if count == 0:
            count = 1
        return count

    def analyze_keyword_density(self, text: str, keywords: List[str]) -> Dict[str, float]:
        """Calculate keyword density for given keywords"""
        text_lower = text.lower()
        word_count = len(text.split())
        
        if word_count == 0:
            return {keyword: 0.0 for keyword in keywords}
            
        densities = {}
        for keyword in keywords:
            keyword_lower = keyword.lower()
            occurrences = text_lower.count(keyword_lower)
            density = (occurrences * len(keyword.split())) / word_count * 100
            densities[keyword] = round(density, 2)
            
        return densities

    def analyze_heading_structure(self, html_content: str) -> Dict[str, int]:
        """Analyze HTML heading structure (h1-h6)"""
        heading_counts = {}
        for i in range(1, 7):
            pattern = f"<h{i}.*?>(.*?)</h{i}>"
            headings = re.findall(pattern, html_content, re.IGNORECASE | re.DOTALL)
            heading_counts[f'h{i}'] = len(headings)
        return heading_counts

    async def analyze_content(self, content: str, html_content: Optional[str] = None) -> ContentMetrics:
        """Main method to analyze content quality"""
        # Initialize metrics
        metrics = {
            "word_count": len(content.split()),
            "keyword_density": self.analyze_keyword_density(content, self.config.important_keywords),
            "readability_score": self.calculate_readability(content),
            "sentiment_score": TextBlob(content).sentiment.polarity,
            "heading_structure": self.analyze_heading_structure(html_content) if html_content else {},
            "meta_description_length": None,
            "title_length": None,
            "content_issues": [],
            "improvement_suggestions": []
        }

        # Check word count
        if metrics["word_count"] < self.config.min_word_count:
            metrics["content_issues"].append(f"Content length ({metrics['word_count']} words) is below recommended minimum ({self.config.min_word_count} words)")
            metrics["improvement_suggestions"].append("Expand content to improve comprehensiveness")

        # Check keyword density
        for keyword, density in metrics["keyword_density"].items():
            if density > self.config.max_keyword_density:
                metrics["content_issues"].append(f"Keyword '{keyword}' appears too frequently ({density}%)")
                metrics["improvement_suggestions"].append(f"Reduce usage of '{keyword}' to avoid keyword stuffing")

        # Check readability
        if metrics["readability_score"] < self.config.target_readability_score:
            metrics["content_issues"].append("Content may be too difficult to read")
            metrics["improvement_suggestions"].append("Simplify language and use shorter sentences")

        # Check heading structure if HTML is provided
        if html_content:
            if metrics["heading_structure"].get("h1", 0) == 0:
                metrics["content_issues"].append("Missing H1 heading")
                metrics["improvement_suggestions"].append("Add a clear H1 heading")
            elif metrics["heading_structure"].get("h1", 0) > 1:
                metrics["content_issues"].append("Multiple H1 headings detected")
                metrics["improvement_suggestions"].append("Use only one H1 heading per page")

        # Check meta description and title if HTML is provided
        if html_content and self.config.check_meta_description:
            meta_desc = re.search('<meta name="description" content="(.*?)"', html_content)
            if meta_desc:
                metrics["meta_description_length"] = len(meta_desc.group(1))
                if metrics["meta_description_length"] > 160:
                    metrics["content_issues"].append("Meta description too long")
                    metrics["improvement_suggestions"].append("Keep meta description under 160 characters")
                elif metrics["meta_description_length"] < 120:
                    metrics["content_issues"].append("Meta description too short")
                    metrics["improvement_suggestions"].append("Expand meta description to 120-160 characters")

        if html_content and self.config.check_title:
            title = re.search('<title>(.*?)</title>', html_content)
            if title:
                metrics["title_length"] = len(title.group(1))
                if metrics["title_length"] > 60:
                    metrics["content_issues"].append("Title too long")
                    metrics["improvement_suggestions"].append("Keep title under 60 characters")
                elif metrics["title_length"] < 30:
                    metrics["content_issues"].append("Title too short")
                    metrics["improvement_suggestions"].append("Expand title to 30-60 characters")

        return ContentMetrics(**metrics)

    def generate_report(self, metrics: ContentMetrics) -> str:
        """Generate a human-readable report from metrics"""
        report = [
            "Content Analysis Report",
            "=====================\n",
            f"Word Count: {metrics.word_count}",
            f"Readability Score: {metrics.readability_score:.1f}/100.0",
            f"Sentiment Score: {metrics.sentiment_score:.2f} (-1 to 1)",
            "\nKeyword Density:",
        ]
        
        for keyword, density in metrics.keyword_density.items():
            report.append(f"- {keyword}: {density}%")
            
        if metrics.heading_structure:
            report.append("\nHeading Structure:")
            for heading, count in metrics.heading_structure.items():
                report.append(f"- {heading}: {count}")
                
        if metrics.meta_description_length:
            report.append(f"\nMeta Description Length: {metrics.meta_description_length} characters")
            
        if metrics.title_length:
            report.append(f"Title Length: {metrics.title_length} characters")
            
        if metrics.content_issues:
            report.append("\nContent Issues:")
            for issue in metrics.content_issues:
                report.append(f"- {issue}")
                
        if metrics.improvement_suggestions:
            report.append("\nSuggestions for Improvement:")
            for suggestion in metrics.improvement_suggestions:
                report.append(f"- {suggestion}")
                
        return "\n".join(report) 