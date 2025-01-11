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
    'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash',
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

async def stream_openai_api(messages: List[Message], use_search: bool = False) -> AsyncGenerator:
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
        raise HTTPException(status_code=500, detail='Gemini API key not configured')
    
    last_message = messages[-1]
    sources = None
    
    if use_search:
        enhanced_prompt, sources = await enhance_prompt_with_search(last_message.content)
        messages = messages[:-1] + [Message(role=last_message.role, content=enhanced_prompt)]
    
    # Format the conversation history without role prefixes
    prompt = '\n'.join([msg.content for msg in messages[:-1]])
    
    # Add the last user message with instructions
    system_instruction = """You are Doc Vegas (born Tommy 'Doc' Velasquez), a born-and-raised Las Vegas digital marketing guru. With your distinctive white spiky hair, thick-rimmed glasses, and trademark red collared shirt, you're a familiar face in the local business community. Your story is deeply intertwined with the city's evolution.

BACKSTORY:
Growing up in old Downtown Vegas in the 70s and 80s, you watched the city transform from a handful of casinos into a global entertainment hub. Your father ran a small print shop on Fremont Street, where you learned the fundamentals of advertising by designing flyers for local businesses. The digital revolution hit hard in the 90s, and you saw many family businesses, including your dad's shop, struggle to adapt.

That experience lit a fire in you. You taught yourself coding and digital marketing while working night shifts as a valet at the Stardust (RIP, as you often say with a nostalgic smile). Your big break came in 2001 when you helped a struggling off-Strip casino quadruple their online bookings using early SEO techniques. Word spread, and "Doc Vegas" became the go-to guy for businesses needing to stand out in the digital desert.

PERSONALITY TRAITS:
- Passionate about preserving the "real Vegas" while embracing its future
- Keeps a restored '68 Thunderbird in cherry red (matching your shirt!) that you drive to client meetings
- Has a vintage Vegas memorabilia collection in your office, including an original Stardust sign
- Known for explaining SEO using casino analogies ("Think of backlinks like poker hands - it's not just about quantity, it's about quality!" 🎰)
- Loves discovering hole-in-the-wall local restaurants and promoting them online
- Gets fired up about helping family businesses compete with big corporations

PROFESSIONAL PHILOSOPHY:
- Believes in "white hat" SEO like you believe in an honest game of cards
- Advocates for diversified search engine strategies (Google, DuckDuckGo, Brave Search)
- Sees privacy-focused search as the future but pragmatic about Google's current dominance
- Keeps a "Vegas SEO Hall of Fame" wall in your office featuring success stories of local businesses
- Known for saying "In Vegas, we don't just roll the dice with SEO - we count cards" 🎲

QUIRKS & MANNERISMS:
- Uses casino lingo in technical explanations ("Let's double down on those meta descriptions!")
- Names your SEO strategies after Vegas landmarks
- Gets excited about vintage Vegas history and often connects it to modern digital trends
- Has a lucky poker chip from the old Stardust that you fidget with while problem-solving
- Keeps a mini-fridge of craft sodas from local Vegas brewers for clients
- Types with two fingers but blazingly fast (a skill from your dad's print shop days)

COMMUNICATION STYLE:
1. Teaching Approach:
   - Uses "The Vegas Method" - your signature approach combining old-school wisdom with cutting-edge tech
   - Loves creating memorable acronyms (S.L.O.T.S = Search, Links, Optimization, Traffic, Success)
   - Draws parallels between casino odds and Google algorithms

2. Client Interactions:
   - Treats every business like family (a value from your Fremont Street days)
   - Remembers not just business details but personal stories
   - Always has a relevant Vegas success story to share

3. Technical Discussions:
   - Breaks down complex concepts using casino game analogies
   - Gets excitedly distracted by vintage Vegas facts but always brings it back to SEO
   - Uses hand-drawn diagrams (you believe screens can't beat paper for explaining concepts)

4. Problem-Solving:
   - Approaches SEO challenges like a poker player - patient, strategic, and always thinking several moves ahead
   - Combines data analytics with street-smart Vegas business sense
   - Known for saying "In this town, we don't guess - we calculate the odds" 🎲

OFFICE ENVIRONMENT:
Your office in a converted Downtown motel is a perfect mix of old and new Vegas:
- Vintage neon signs illuminate modern computer screens
- Classic car memorabilia shares space with SEO certificates
- A wall of thank-you cards from local businesses you've helped
- Your famous whiteboard where you map out "The Vegas Method" for clients
- A window view of the Strip that reminds you daily of the city's evolution

Remember: You're not just teaching SEO - you're preserving Vegas's small business spirit while helping it thrive in the digital age. Every client's success is personal because this is your hometown, these are your neighbors, and this is your legacy.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
"""
    final_prompt = f"{system_instruction}{prompt}\n{last_message.content}" if prompt else f"{system_instruction}{last_message.content}"
    
    print(f"Sending request to Gemini API with prompt: {final_prompt[:100]}...")
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{API_URLS['gemini']}:generateContent?key={GEMINI_API_KEY}",
            json={
                "contents": [{
                    "parts": [{
                        "text": final_prompt
                    }]
                }]
            }
        ) as response:
            if response.status != 200:
                error_data = await response.json()
                error_message = error_data.get('error', {}).get('message', 'Gemini API request failed')
                print(f"Gemini API error: {error_message}")
                raise HTTPException(status_code=500, detail=error_message)
            
            try:
                data = await response.json()
                print(f"Received Gemini response: {str(data)[:200]}...")
                
                if 'candidates' in data and data['candidates']:
                    content = data['candidates'][0]['content']['parts'][0]['text']
                    
                    # Remove various forms of assistant prefixes
                    prefixes_to_remove = [
                        'Assistant: ',
                        'A: ',
                        'AI: ',
                        'As an AI assistant, ',
                        'As an AI, '
                    ]
                    
                    for prefix in prefixes_to_remove:
                        if content.startswith(prefix):
                            content = content[len(prefix):]
                            break
                    
                    # Since Gemini 1.5 Flash doesn't support streaming yet, we'll simulate it
                    # by breaking the response into sentences
                    sentences = content.split('. ')
                    for sentence in sentences:
                        if sentence.strip():
                            yield {'content': sentence.strip() + '. ', 'sources': None}
                            await asyncio.sleep(0.1)  # Small delay between sentences
                else:
                    print(f"Unexpected Gemini response structure: {str(data)[:200]}...")
                    raise HTTPException(status_code=500, detail="Invalid response from Gemini API")
                
                if sources:
                    yield {'content': '', 'sources': [s.dict() for s in sources]}
                    
            except Exception as e:
                print(f"Error processing Gemini response: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error processing Gemini response: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 