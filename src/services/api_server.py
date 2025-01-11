from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import aiohttp
import os
from dotenv import load_dotenv
import asyncio
import json
from ..config.character import SYSTEM_MESSAGE
from .agents.content_analyzer import ContentAnalysisAgent, ContentAnalysisConfig
from bs4 import BeautifulSoup

load_dotenv()

app = FastAPI()

# Debug logging for environment variables
print("Environment variables:")
print(f"GEMINI_API_KEY present: {'VITE_GEMINI_API_KEY' in os.environ}")
print(f"GEMINI_API_KEY value: {os.getenv('VITE_GEMINI_API_KEY')[:10]}...")

DEEPSEEK_API_KEY = os.getenv('VITE_DEEPSEEK_API_KEY')
OPENAI_API_KEY = os.getenv('VITE_OPENAI_API_KEY')
GEMINI_API_KEY = os.getenv('VITE_GEMINI_API_KEY')
BRAVE_API_KEY = os.getenv('VITE_BRAVE_API_KEY')

API_URLS = {
    'deepseek': 'https://api.deepseek.com/v1/chat/completions',
    'openai': 'https://api.openai.com/v1/chat/completions',
    'gemini': 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:streamGenerateContent',
    'brave': 'https://api.search.brave.com/res/v1/web/search'
}

class Message(BaseModel):
    role: str
    content: str

class Source(BaseModel):
    title: str
    url: str
    snippet: Optional[str] = None
    content: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = 'gemini'
    use_search: bool = False

class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[Source]] = None
    search_performed: bool = False

async def scrape_page_content(url: str) -> str:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return ""
                html = await response.text()
                
                # Basic HTML cleaning - remove scripts, styles, etc.
                html = html.split('<script')[0]  # Remove script tags and everything after
                html = '\n'.join(
                    line
                    for line in html.split('\n')
                    if not any(tag in line.lower() for tag in ['<style', '<script', '<meta', '<link'])
                )
                
                # Remove remaining HTML tags
                text = ''
                in_tag = False
                for char in html:
                    if char == '<':
                        in_tag = True
                    elif char == '>':
                        in_tag = False
                    elif not in_tag:
                        text += char
                
                # Clean up whitespace
                text = ' '.join(text.split())
                
                # Return first 5000 characters
                return text[:5000]
    except Exception as e:
        print(f"Error scraping content from {url}: {e}")
        return ""

async def search_brave(query: str, retries: int = 2) -> List[Source]:
    for attempt in range(retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    API_URLS['brave'],
                    headers={'X-Subscription-Token': BRAVE_API_KEY},
                    params={
                        'q': query,
                        'count': 5,
                        'search_lang': 'en',
                        'safesearch': 'moderate'
                    }
                ) as response:
                    if response.status != 200:
                        print(f"Brave Search API error: {response.status} (Attempt {attempt + 1}/{retries})")
                        if attempt < retries - 1:
                            await asyncio.sleep(1)
                            continue
                        return []
                    
                    try:
                        data = await response.json()
                        sources = []
                        results = data.get('web', {}).get('results', [])
                        
                        for result in results[:5]:
                            if result.get('url') and result.get('title'):
                                # Scrape content from the page
                                content = await scrape_page_content(result.get('url'))
                                
                                sources.append(Source(
                                    title=result.get('title', 'No Title').strip(),
                                    url=result.get('url', '').strip(),
                                    snippet=result.get('description', '').strip(),
                                    content=content
                                ))
                        
                        return sources
                        
                    except Exception as e:
                        print(f"Error processing search results: {e} (Attempt {attempt + 1}/{retries})")
                        if attempt < retries - 1:
                            await asyncio.sleep(1)
                            continue
        except Exception as e:
            print(f"Unexpected error in search_brave: {e} (Attempt {attempt + 1}/{retries})")
            if attempt < retries - 1:
                await asyncio.sleep(1)
                continue
    
    return []

async def enhance_prompt_with_search(message: str) -> tuple[str, List[Source]]:
    # Try to get sources for the exact query
    sources = await search_brave(message)
    
    # If no sources found, try with a more SEO-focused query
    if not sources:
        seo_query = f"Las Vegas SEO {message}"
        sources = await search_brave(seo_query)
    
    # If still no sources, try one last time with a broader query
    if not sources:
        broader_query = f"digital marketing {message}"
        sources = await search_brave(broader_query)
    
    if not sources:
        return message, []
    
    enhanced_prompt = (
        f"{message}\n\n"
        f"Here is some relevant information from trusted sources:\n\n"
    )
    
    for source in sources:
        if source.content:
            enhanced_prompt += f"From {source.title}:\n{source.content[:1000]}...\n\n"
        elif source.snippet:
            enhanced_prompt += f"From {source.title}:\n{source.snippet}\n\n"
    
    return enhanced_prompt, sources

async def stream_response(generator: AsyncGenerator) -> StreamingResponse:
    async def stream_generator():
        try:
            async for chunk in generator:
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream"
    )

async def stream_deepseek_api(messages: List[Message], use_search: bool = False) -> AsyncGenerator:
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages = messages[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]
    
    # Add system message to the beginning of the messages list
    messages_with_system = [Message(**SYSTEM_MESSAGE)] + messages
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            API_URLS['deepseek'],
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': m.role, 'content': m.content} for m in messages_with_system],
                'temperature': 0.7,
                'max_tokens': 1000,
                'stream': True
            }
        ) as response:
            if response.status != 200:
                raise HTTPException(status_code=500, detail='DeepSeek API request failed')
            
            async for line in response.content:
                if line:
                    try:
                        data = json.loads(line.decode('utf-8').strip('data: ').strip())
                        if data != '[DONE]':
                            content = data['choices'][0]['delta'].get('content', '')
                            if content:
                                yield {'content': content, 'sources': None}
                    except Exception as e:
                        print(f"Error parsing streaming response: {e}")
            
            if sources:
                yield {'content': '', 'sources': [s.dict() for s in sources]}

async def stream_openai_api(messages: List[Message], use_search: bool = False) -> AsyncGenerator:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail='OpenAI API key not configured')
    
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages = messages[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]
    
    # Add system message to the beginning of the messages list
    messages_with_system = [Message(**SYSTEM_MESSAGE)] + messages
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            API_URLS['openai'],
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {OPENAI_API_KEY}'
            },
            json={
                'model': 'gpt-4',
                'messages': [{'role': m.role, 'content': m.content} for m in messages_with_system],
                'temperature': 0.7,
                'max_tokens': 1000,
                'stream': True
            }
        ) as response:
            if response.status != 200:
                raise HTTPException(status_code=500, detail='OpenAI API request failed')
            
            async for line in response.content:
                if line:
                    try:
                        data = json.loads(line.decode('utf-8').strip('data: ').strip())
                        if data != '[DONE]':
                            content = data['choices'][0]['delta'].get('content', '')
                            if content:
                                yield {'content': content, 'sources': None}
                    except Exception as e:
                        print(f"Error parsing streaming response: {e}")
            
            if sources:
                yield {'content': '', 'sources': [s.dict() for s in sources]}

async def stream_gemini_api(messages: List[Message], use_search: bool = False) -> AsyncGenerator:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured. Please set the VITE_GEMINI_API_KEY environment variable.")

    messages_with_system = [Message(**SYSTEM_MESSAGE)] + messages
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages_with_system = messages_with_system[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]

    formatted_messages = []
    for msg in messages_with_system:
        # Map roles to either 'user' or 'model'
        role = "model" if msg.role in ["assistant", "system"] else "user"
        formatted_messages.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })

    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            }
            
            data = {
                "contents": formatted_messages,
                "generationConfig": {
                    "temperature": 0.7,
                    "topK": 1,
                    "topP": 1,
                    "maxOutputTokens": 2048,
                    "model": "gemini-2.0-flash-exp"
                },
                "safetySettings": [
                    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"}
                ]
            }

            print("Sending request to Gemini API...")
            print(f"Formatted messages: {json.dumps(formatted_messages, indent=2)}")
            
            async with session.post(
                API_URLS['gemini'],
                headers=headers,
                json=data
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Gemini API error: {error_text}")
                    raise HTTPException(status_code=500, detail=f"Gemini API request failed: {error_text}")

                response_data = await response.json()
                print(f"Gemini API response: {json.dumps(response_data, indent=2)}")
                
                # Handle list response format
                if isinstance(response_data, list):
                    # Concatenate text from all responses
                    full_text = ""
                    for resp in response_data:
                        if resp.get("candidates"):
                            for candidate in resp["candidates"]:
                                if candidate.get("content") and candidate["content"].get("parts"):
                                    for part in candidate["content"]["parts"]:
                                        if part.get("text"):
                                            full_text += part["text"]
                                elif candidate.get("finishReason") == "SAFETY":
                                    raise HTTPException(
                                        status_code=400,
                                        detail="I apologize, but I cannot provide a response to that query due to content safety guidelines. Please try rephrasing your request."
                                    )
                    
                    if not full_text:
                        raise HTTPException(status_code=500, detail="No valid response generated. Please try again.")
                    
                    response_data = {
                        "candidates": [{
                            "content": {
                                "parts": [{"text": full_text}]
                            }
                        }]
                    }

                if not response_data.get("candidates"):
                    print(f"No candidates in Gemini response: {response_data}")
                    raise HTTPException(status_code=500, detail="No response generated. Please try again.")

                full_text = ""
                for candidate in response_data["candidates"]:
                    if candidate.get("finishReason") == "SAFETY":
                        raise HTTPException(
                            status_code=400, 
                            detail="I apologize, but I cannot provide a response to that query due to content safety guidelines. Please try rephrasing your request."
                        )
                    if "content" in candidate and "parts" in candidate["content"]:
                        for part in candidate["content"]["parts"]:
                            if "text" in part:
                                full_text += part["text"]

                if not full_text:
                    raise HTTPException(status_code=500, detail="Empty response from Gemini API")

                # Split response into smaller pieces for streaming
                sentences = []
                current_sentence = ""
                for char in full_text:
                    current_sentence += char
                    # Check for end of sentence or numbered list item
                    if char in ".!?" or (current_sentence.strip().endswith('.') and current_sentence.strip()[:-1].isdigit()):
                        sentences.append(current_sentence.strip())
                        current_sentence = ""
                
                if current_sentence.strip():
                    sentences.append(current_sentence.strip())

                for sentence in sentences:
                    yield {"content": sentence + " ", "sources": None}
                    await asyncio.sleep(0.1)  # 100ms delay

                if sources:
                    yield {"content": "", "sources": [s.model_dump() for s in sources]}

    except Exception as e:
        print(f"Unexpected error in Gemini handler: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        model_handlers = {
            'deepseek': stream_deepseek_api,
            'openai': stream_openai_api,
            'gemini': stream_gemini_api
        }
        
        handler = model_handlers.get(request.model)
        if not handler:
            raise HTTPException(status_code=400, detail=f'Unsupported model: {request.model}')
        
        return await stream_response(handler(request.messages, request.use_search))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/seo/audit")
async def seo_audit(request: Request):
    try:
        data = await request.json()
        url = data.get('url')
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
            
        # Clean the URL before using it in the report
        clean_url = url.replace(" ", "")

        # Fetch the page content
        async with aiohttp.ClientSession() as session:
            async with session.get(clean_url) as response:
                if response.status != 200:
                    error_report = f"""Website Audit: {clean_url}

Overview
The URL {clean_url} does not appear to be accessible. The server returned a {response.status} error.

Additional Notes
- The page returned a {response.status} error code
- Please verify the URL is correct and the page is accessible
- Check if the URL requires authentication or has restricted access"""

                    return JSONResponse({
                        "status": "error",
                        "report": error_report
                    })

                html_content = await response.text()

        # Parse HTML and extract text content
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
            
        # Get text content
        text_content = soup.get_text()
        
        # Clean up text (remove extra whitespace)
        text_content = " ".join(text_content.split())

        # Initialize the content analysis agent with page-specific focus
        agent = ContentAnalysisAgent(
            config=ContentAnalysisConfig(
                important_keywords=[
                    "Las Vegas",
                    "Vegas",
                    "Nevada",
                    "NV",
                    "casino",
                    "resort",
                    "hotel",
                    "entertainment",
                    "tourism"
                ],
                min_word_count=300,
                max_keyword_density=2.5,
                target_readability_score=60.0
            )
        )

        # Analyze the content
        metrics = await agent.analyze_content(text_content, html_content)
        report = f"""Page Audit: {clean_url}

{agent.generate_report(metrics)}"""

        return JSONResponse({
            "status": "success",
            "report": report
        })

    except aiohttp.ClientError as e:
        error_report = f"""Page Audit: {url}

Overview
Unable to access {url}. The page appears to be unavailable.

Additional Notes
- The connection to the page failed
- Please verify:
  - The URL is correct
  - The page is accessible
  - Your internet connection is stable"""

        return JSONResponse({
            "status": "error",
            "report": error_report
        })

    except Exception as e:
        print(f"Error in SEO audit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 