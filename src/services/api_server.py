from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, AsyncGenerator
import aiohttp
import os
from dotenv import load_dotenv
import asyncio
import json

load_dotenv()

app = FastAPI()

DEEPSEEK_API_KEY = 'sk-5c1d1a57a53246a79869b2d64b4da379'
OPENAI_API_KEY = os.getenv('VITE_OPENAI_API_KEY')
GEMINI_API_KEY = os.getenv('VITE_GEMINI_API_KEY')
BRAVE_API_KEY = os.getenv('VITE_BRAVE_API_KEY', 'BSA9ju8rWHoSYkOU0FdxGDrX0xolfdd')

API_URLS = {
    'deepseek': 'https://api.deepseek.com/v1/chat/completions',
    'openai': 'https://api.openai.com/v1/chat/completions',
    'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
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
    model: str = 'deepseek'
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
                html = html.split('<script')[0]  # Remove all script tags and content after
                html = '\n'.join(line for line in html.split('\n') if not any(tag in line.lower() for tag in ['<style', '<script', '<meta', '<link']))
                
                # Remove HTML tags
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
                        
                        # Process each result and ensure we have valid data
                        for result in results[:5]:  # Limit to top 5 results
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
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            API_URLS['deepseek'],
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [{'role': m.role, 'content': m.content} for m in messages],
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

async def call_openai_api(messages: List[Message], use_search: bool = False) -> tuple[str, Optional[List[Source]]]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail='OpenAI API key not configured')
    
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages = messages[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            API_URLS['openai'],
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {OPENAI_API_KEY}'
            },
            json={
                'model': 'gpt-4',
                'messages': [{'role': m.role, 'content': m.content} for m in messages],
                'temperature': 0.7,
                'max_tokens': 1000
            }
        ) as response:
            if response.status != 200:
                raise HTTPException(status_code=500, detail='OpenAI API request failed')
            data = await response.json()
            return data['choices'][0]['message']['content'], sources

async def call_gemini_api(messages: List[Message], use_search: bool = False) -> tuple[str, Optional[List[Source]]]:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail='Gemini API key not configured')
    
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages = messages[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]
    
    # Format the conversation history without role prefixes
    prompt = '\n'.join([msg.content for msg in messages[:-1]])
    
    # Add the last user message with instructions
    last_message = messages[-1]
    system_instruction = "You are a Las Vegas SEO Guru and digital marketing expert. Never mention that you are an AI or assistant. Never use phrases like 'As an AI' or similar self-references. Respond directly to questions and provide expert, practical advice based on your experience with the Las Vegas market.\n\n"
    final_prompt = f"{system_instruction}{prompt}\n{last_message.content}" if prompt else f"{system_instruction}{last_message.content}"
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URLS['gemini']}?key={GEMINI_API_KEY}",
            json={
                'contents': [{
                    'parts': [{
                        'text': final_prompt
                    }]
                }],
                'generationConfig': {
                    'temperature': 0.7,
                    'topP': 1,
                    'topK': 1,
                    'maxOutputTokens': 1000,
                },
                'safetySettings': [
                    {
                        'category': "HARM_CATEGORY_HARASSMENT",
                        'threshold': "BLOCK_NONE"
                    }
                ]
            }
        ) as response:
            if response.status != 200:
                raise HTTPException(status_code=500, detail='Gemini API request failed')
            data = await response.json()
            response_text = data['candidates'][0]['content']['parts'][0]['text']
            
            # Remove various forms of assistant prefixes
            prefixes_to_remove = [
                'Assistant: ',
                'A: ',
                'AI: ',
                'As an AI assistant, ',
                'As an AI, '
            ]
            
            for prefix in prefixes_to_remove:
                if response_text.startswith(prefix):
                    response_text = response_text[len(prefix):]
                    break
            
            return response_text, sources

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        model_handlers = {
            'deepseek': stream_deepseek_api,
            'openai': call_openai_api,
            'gemini': call_gemini_api
        }
        
        handler = model_handlers.get(request.model)
        if not handler:
            raise HTTPException(status_code=400, detail=f'Unsupported model: {request.model}')
        
        return await stream_response(handler(request.messages, request.use_search))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 