from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import httpx
import random
from cachetools import TTLCache

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Google Sheets Configuration - Uzak Şehir
SHEET_ID = "2PACX-1vSu7BsXwstBjCgg7zhtdNzxLE3OQYNM6mI_tJ5Z-9P6qcCfMm8hGrRTdUuemYtjD-6lq9mH78qSuvPz"
EPISODES_GID = "0"
QUESTIONS_GID = "1459380949"

# Cache with 5 minute TTL
cache = TTLCache(maxsize=100, ttl=300)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# === MODELS ===

class Episode(BaseModel):
    id: int
    name: str
    question_count: int = 25
    is_locked: bool = False
    description: str = ""

class QuestionOption(BaseModel):
    id: str
    text: str

class Question(BaseModel):
    id: str
    text: str
    options: List[QuestionOption]
    correct_option: str
    difficulty: str
    points: int

class QuizResponse(BaseModel):
    episode_id: Optional[int] = None
    episode_name: str
    questions: List[Question]
    total_questions: int
    max_possible_score: int
    mode: str = "episode"  # "episode" or "mixed"

# Score submission models
class ScoreSubmit(BaseModel):
    player_name: str
    score: int
    correct_count: int = 0
    speed_bonus: int = 0

class EpisodeScoreSubmit(ScoreSubmit):
    episode_id: int

class MixedScoreSubmit(ScoreSubmit):
    questions_answered: int = 0

# Leaderboard response models
class LeaderboardEntry(BaseModel):
    rank: int
    player_name: str
    score: int
    timestamp: Optional[datetime] = None

class LeaderboardResponse(BaseModel):
    entries: List[Dict[str, Any]]
    player_rank: Optional[int] = None
    player_score: Optional[int] = None
    total_players: int = 0

# === GOOGLE SHEETS FUNCTIONS ===

async def fetch_csv_from_sheets(gid: str) -> str:
    """Fetch CSV data from Google Sheets"""
    url = f"https://docs.google.com/spreadsheets/d/e/{SHEET_ID}/pub?gid={gid}&single=true&output=csv"
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        response = await http_client.get(url)
        response.raise_for_status()
        return response.text

def parse_csv(csv_text: str) -> List[Dict[str, str]]:
    """Parse CSV text into list of dictionaries"""
    lines = csv_text.strip().split('\n')
    if len(lines) < 2:
        return []
    
    headers = [h.strip().lower().replace(' ', '_') for h in lines[0].split(',')]
    rows = []
    
    for line in lines[1:]:
        values = []
        current = ""
        in_quotes = False
        
        for char in line:
            if char == '"':
                in_quotes = not in_quotes
            elif char == ',' and not in_quotes:
                values.append(current.strip())
                current = ""
            else:
                current += char
        values.append(current.strip())
        
        if len(values) >= len(headers):
            row = {headers[i]: values[i] for i in range(len(headers))}
            rows.append(row)
    
    return rows

async def get_episodes_data() -> List[Episode]:
    """Get episodes from Google Sheets with caching"""
    cache_key = "episodes"
    if cache_key in cache:
        return cache[cache_key]
    
    try:
        csv_text = await fetch_csv_from_sheets(EPISODES_GID)
        rows = parse_csv(csv_text)
        
        logger.info(f"Parsed {len(rows)} episode rows")
        if rows:
            logger.info(f"First row keys: {list(rows[0].keys())}")
        
        episodes = []
        for row in rows:
            try:
                # Try different column name variations
                episode_id = int(row.get('episode_id') or row.get('id') or row.get('bölüm_no') or row.get('bolum_no') or 0)
                episode_name = row.get('episode_name') or row.get('name') or row.get('bölüm_adı') or row.get('bolum_adi') or f"{episode_id}. Bölüm"
                is_locked = (row.get('is_locked') or row.get('durum') or 'açık').lower() in ['kilitli', 'locked', 'true', '1']
                description = row.get('description') or row.get('açıklama') or row.get('aciklama') or ''
                
                if episode_id > 0:
                    episode = Episode(
                        id=episode_id,
                        name=episode_name,
                        question_count=25,
                        is_locked=is_locked,
                        description=description
                    )
                    episodes.append(episode)
            except Exception as e:
                logger.warning(f"Error parsing episode row: {e}, row: {row}")
                continue
        
        # Ensure we have at least 14 episodes (fill missing ones)
        existing_ids = {e.id for e in episodes}
        for i in range(1, 15):
            if i not in existing_ids:
                episodes.append(Episode(
                    id=i,
                    name=f"{i}. Bölüm",
                    question_count=25,
                    is_locked=False
                ))
        
        episodes.sort(key=lambda e: e.id)
        cache[cache_key] = episodes  # No limit - show all episodes from sheets
        return episodes
    except Exception as e:
        logger.error(f"Error fetching episodes: {e}")
        return [Episode(id=i, name=f"{i}. Bölüm", question_count=25) for i in range(1, 15)]

async def get_questions_data() -> Dict[int, List[Dict]]:
    """Get all questions from Google Sheets with caching"""
    cache_key = "questions"
    if cache_key in cache:
        return cache[cache_key]
    
    try:
        csv_text = await fetch_csv_from_sheets(QUESTIONS_GID)
        rows = parse_csv(csv_text)
        
        logger.info(f"Parsed {len(rows)} question rows")
        if rows:
            logger.info(f"First question row keys: {list(rows[0].keys())}")
        
        questions_by_episode: Dict[int, List[Dict]] = {}
        
        for row in rows:
            try:
                # Try different column name variations for episode
                episode_id = int(
                    row.get('episode_id') or row.get('episode') or 
                    row.get('bölüm') or row.get('bolum') or 1
                )
                
                # Try different column names for difficulty and points
                difficulty_raw = row.get('difficulty') or row.get('zorluk') or 'orta'
                difficulty = difficulty_raw.lower()
                if difficulty in ['easy', 'kolay']:
                    points = 10
                    difficulty = 'kolay'
                elif difficulty in ['hard', 'zor']:
                    points = 50
                    difficulty = 'zor'
                else:
                    points = 20
                    difficulty = 'orta'
                
                # Override with explicit points if provided
                if row.get('points') or row.get('puan'):
                    try:
                        points = int(row.get('points') or row.get('puan'))
                    except:
                        pass
                
                # Get correct answer - try different column names
                correct_raw = (
                    row.get('correct_answer') or row.get('correct') or 
                    row.get('doğru_cevap') or row.get('dogru_cevap') or 'A'
                )
                correct_answer = correct_raw.strip().upper()
                
                question = {
                    'id': row.get('question_id') or row.get('id') or row.get('soru_id') or str(uuid.uuid4()),
                    'text': row.get('question') or row.get('text') or row.get('soru') or '',
                    'options': {
                        'A': row.get('option_a') or row.get('a') or '',
                        'B': row.get('option_b') or row.get('b') or '',
                        'C': row.get('option_c') or row.get('c') or '',
                        'D': row.get('option_d') or row.get('d') or ''
                    },
                    'correct_answer': correct_answer,
                    'difficulty': difficulty,
                    'points': points,
                    'episode_id': episode_id
                }
                
                if question['text'] and any(question['options'].values()):
                    if episode_id not in questions_by_episode:
                        questions_by_episode[episode_id] = []
                    questions_by_episode[episode_id].append(question)
            except Exception as e:
                logger.warning(f"Error parsing question row: {e}, row: {row}")
                continue
        
        logger.info(f"Loaded questions for episodes: {list(questions_by_episode.keys())}")
        for ep, qs in questions_by_episode.items():
            logger.info(f"Episode {ep}: {len(qs)} questions")
        
        cache[cache_key] = questions_by_episode
        return questions_by_episode
    except Exception as e:
        logger.error(f"Error fetching questions: {e}")
        return {}

def transform_question(q: Dict) -> Question:
    """Transform a raw question dict to Question model with shuffled options"""
    option_keys = ['A', 'B', 'C', 'D']
    options_list = [(key, q['options'][key]) for key in option_keys if q['options'].get(key)]
    random.shuffle(options_list)
    
    correct_text = q['options'].get(q['correct_answer'], '')
    correct_id = 'A'
    for i, (_, text) in enumerate(options_list):
        if text == correct_text:
            correct_id = option_keys[i]
            break
    
    return Question(
        id=q['id'],
        text=q['text'],
        options=[QuestionOption(id=option_keys[i], text=text) for i, (_, text) in enumerate(options_list)],
        correct_option=correct_id,
        difficulty=q['difficulty'],
        points=q['points']
    )

# === API ENDPOINTS ===

@api_router.get("/")
async def root():
    return {"message": "Uzak Şehir Quiz API", "version": "2.0"}

@api_router.get("/episodes", response_model=List[Episode])
async def get_episodes():
    """Get all 14 episodes"""
    return await get_episodes_data()

@api_router.get("/quiz/episode/{episode_id}", response_model=QuizResponse)
async def get_episode_quiz(episode_id: int, count: int = 25):
    """Get quiz questions for a specific episode (25 questions)"""
    if episode_id < 1 or episode_id > 14:
        raise HTTPException(status_code=400, detail="Geçersiz bölüm ID (1-14)")
    
    questions_data = await get_questions_data()
    episode_questions = questions_data.get(episode_id, [])
    
    if not episode_questions:
        raise HTTPException(status_code=404, detail="Bu bölüm için soru bulunamadı")
    
    # Select up to 25 questions
    selected = random.sample(episode_questions, min(count, len(episode_questions), 25))
    
    quiz_questions = [transform_question(q) for q in selected]
    max_score = sum(q.points for q in quiz_questions) + (len(quiz_questions) * 5)  # Include speed bonus
    
    episodes = await get_episodes_data()
    episode = next((e for e in episodes if e.id == episode_id), None)
    
    return QuizResponse(
        episode_id=episode_id,
        episode_name=episode.name if episode else f"{episode_id}. Bölüm",
        questions=quiz_questions,
        total_questions=len(quiz_questions),
        max_possible_score=max_score,
        mode="episode"
    )

@api_router.get("/quiz/mixed", response_model=QuizResponse)
async def get_mixed_quiz():
    """Get mixed quiz with all questions from all episodes (endless mode)"""
    questions_data = await get_questions_data()
    
    all_questions = []
    for episode_questions in questions_data.values():
        all_questions.extend(episode_questions)
    
    if not all_questions:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")
    
    # Shuffle all questions
    random.shuffle(all_questions)
    
    quiz_questions = [transform_question(q) for q in all_questions]
    max_score = sum(q.points for q in quiz_questions) + (len(quiz_questions) * 5)
    
    return QuizResponse(
        episode_id=None,
        episode_name="Karışık Mod",
        questions=quiz_questions,
        total_questions=len(quiz_questions),
        max_possible_score=max_score,
        mode="mixed"
    )

# === SCORE & LEADERBOARD ENDPOINTS ===

@api_router.post("/score/episode")
async def submit_episode_score(data: EpisodeScoreSubmit):
    """Submit score for episode mode - keeps best score only"""
    collection = db.episode_scores
    
    # Check if player has existing score for this episode
    existing = await collection.find_one({
        "player_name": data.player_name,
        "episode_id": data.episode_id
    })
    
    is_new_record = False
    
    if existing:
        # Update only if new score is higher
        if data.score > existing.get("score", 0):
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "score": data.score,
                    "correct_count": data.correct_count,
                    "speed_bonus": data.speed_bonus,
                    "timestamp": datetime.utcnow()
                }}
            )
            is_new_record = True
    else:
        # Insert new score
        await collection.insert_one({
            "id": str(uuid.uuid4()),
            "player_name": data.player_name,
            "episode_id": data.episode_id,
            "score": data.score,
            "correct_count": data.correct_count,
            "speed_bonus": data.speed_bonus,
            "timestamp": datetime.utcnow()
        })
        is_new_record = True
    
    # Update global score
    await update_global_score(data.player_name)
    
    # Get player's best for this episode
    best = await collection.find_one({
        "player_name": data.player_name,
        "episode_id": data.episode_id
    })
    
    return {
        "success": True,
        "is_new_record": is_new_record,
        "best_score": best.get("score", data.score) if best else data.score
    }

@api_router.post("/score/mixed")
async def submit_mixed_score(data: MixedScoreSubmit):
    """Submit score for mixed mode - keeps best run only"""
    collection = db.mixed_scores
    
    # Check if player has existing score
    existing = await collection.find_one({"player_name": data.player_name})
    
    is_new_record = False
    
    if existing:
        # Update only if new score is higher
        if data.score > existing.get("score", 0):
            await collection.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "score": data.score,
                    "correct_count": data.correct_count,
                    "speed_bonus": data.speed_bonus,
                    "questions_answered": data.questions_answered,
                    "timestamp": datetime.utcnow()
                }}
            )
            is_new_record = True
    else:
        # Insert new score
        await collection.insert_one({
            "id": str(uuid.uuid4()),
            "player_name": data.player_name,
            "score": data.score,
            "correct_count": data.correct_count,
            "speed_bonus": data.speed_bonus,
            "questions_answered": data.questions_answered,
            "timestamp": datetime.utcnow()
        })
        is_new_record = True
    
    # Get player's best
    best = await collection.find_one({"player_name": data.player_name})
    
    return {
        "success": True,
        "is_new_record": is_new_record,
        "best_score": best.get("score", data.score) if best else data.score
    }

async def update_global_score(player_name: str):
    """Calculate and update global score (sum of all episode best scores)"""
    episode_collection = db.episode_scores
    global_collection = db.global_scores
    
    # Get all episode scores for this player
    cursor = episode_collection.find({"player_name": player_name})
    episode_scores = await cursor.to_list(length=100)
    
    # Calculate total
    total_score = sum(s.get("score", 0) for s in episode_scores)
    episodes_completed = len(episode_scores)
    
    # Update or insert global score
    await global_collection.update_one(
        {"player_name": player_name},
        {"$set": {
            "score": total_score,
            "episodes_completed": episodes_completed,
            "timestamp": datetime.utcnow()
        }},
        upsert=True
    )

@api_router.get("/leaderboard/general", response_model=LeaderboardResponse)
async def get_general_leaderboard(player_name: Optional[str] = None):
    """Get general leaderboard (sum of episode best scores)"""
    collection = db.global_scores
    
    # Get top 50
    cursor = collection.find().sort("score", -1).limit(50)
    entries = await cursor.to_list(length=50)
    
    # Get total count
    total = await collection.count_documents({})
    
    # Format entries
    formatted = []
    for i, entry in enumerate(entries):
        formatted.append({
            "rank": i + 1,
            "player_name": entry.get("player_name", "Anonim"),
            "score": entry.get("score", 0),
            "episodes_completed": entry.get("episodes_completed", 0)
        })
    
    # Find player rank
    player_rank = None
    player_score = None
    if player_name:
        player_entry = await collection.find_one({"player_name": player_name})
        if player_entry:
            player_score = player_entry.get("score", 0)
            # Count how many have higher scores
            higher_count = await collection.count_documents({"score": {"$gt": player_score}})
            player_rank = higher_count + 1
    
    return LeaderboardResponse(
        entries=formatted,
        player_rank=player_rank,
        player_score=player_score,
        total_players=total
    )

@api_router.get("/leaderboard/episode/{episode_id}", response_model=LeaderboardResponse)
async def get_episode_leaderboard(episode_id: int, player_name: Optional[str] = None):
    """Get leaderboard for specific episode"""
    if episode_id < 1 or episode_id > 14:
        raise HTTPException(status_code=400, detail="Geçersiz bölüm ID")
    
    collection = db.episode_scores
    
    # Get top 50 for this episode
    cursor = collection.find({"episode_id": episode_id}).sort("score", -1).limit(50)
    entries = await cursor.to_list(length=50)
    
    # Get total count
    total = await collection.count_documents({"episode_id": episode_id})
    
    # Format entries
    formatted = []
    for i, entry in enumerate(entries):
        formatted.append({
            "rank": i + 1,
            "player_name": entry.get("player_name", "Anonim"),
            "score": entry.get("score", 0)
        })
    
    # Find player rank
    player_rank = None
    player_score = None
    if player_name:
        player_entry = await collection.find_one({
            "player_name": player_name,
            "episode_id": episode_id
        })
        if player_entry:
            player_score = player_entry.get("score", 0)
            higher_count = await collection.count_documents({
                "episode_id": episode_id,
                "score": {"$gt": player_score}
            })
            player_rank = higher_count + 1
    
    return LeaderboardResponse(
        entries=formatted,
        player_rank=player_rank,
        player_score=player_score,
        total_players=total
    )

@api_router.get("/leaderboard/mixed", response_model=LeaderboardResponse)
async def get_mixed_leaderboard(player_name: Optional[str] = None):
    """Get mixed mode leaderboard"""
    collection = db.mixed_scores
    
    # Get top 50
    cursor = collection.find().sort("score", -1).limit(50)
    entries = await cursor.to_list(length=50)
    
    # Get total count
    total = await collection.count_documents({})
    
    # Format entries
    formatted = []
    for i, entry in enumerate(entries):
        formatted.append({
            "rank": i + 1,
            "player_name": entry.get("player_name", "Anonim"),
            "score": entry.get("score", 0),
            "questions_answered": entry.get("questions_answered", 0)
        })
    
    # Find player rank
    player_rank = None
    player_score = None
    if player_name:
        player_entry = await collection.find_one({"player_name": player_name})
        if player_entry:
            player_score = player_entry.get("score", 0)
            higher_count = await collection.count_documents({"score": {"$gt": player_score}})
            player_rank = higher_count + 1
    
    return LeaderboardResponse(
        entries=formatted,
        player_rank=player_rank,
        player_score=player_score,
        total_players=total
    )

@api_router.get("/player/{player_name}/stats")
async def get_player_stats(player_name: str):
    """Get player statistics"""
    # Get episode scores
    episode_cursor = db.episode_scores.find({"player_name": player_name})
    episode_scores = await episode_cursor.to_list(length=100)
    
    # Get mixed score
    mixed_score = await db.mixed_scores.find_one({"player_name": player_name})
    
    # Get global score
    global_score = await db.global_scores.find_one({"player_name": player_name})
    
    return {
        "player_name": player_name,
        "global_score": global_score.get("score", 0) if global_score else 0,
        "episodes_completed": len(episode_scores),
        "episode_scores": {s["episode_id"]: s["score"] for s in episode_scores},
        "mixed_best_score": mixed_score.get("score", 0) if mixed_score else 0
    }

# Legacy endpoint for backward compatibility
@api_router.post("/leaderboard")
async def legacy_save_score(data: dict):
    """Legacy endpoint - redirects to new episode score"""
    episode_id = data.get("episode_id", 1)
    player_name = data.get("player_name", "Anonim")
    score = data.get("score", 0)
    
    return await submit_episode_score(EpisodeScoreSubmit(
        episode_id=episode_id,
        player_name=player_name,
        score=score
    ))

@api_router.get("/leaderboard/{episode_id}")
async def legacy_get_leaderboard(episode_id: int, player_name: Optional[str] = None):
    """Legacy endpoint - redirects to episode leaderboard"""
    result = await get_episode_leaderboard(episode_id, player_name)
    # Convert to old format
    return {
        "top_10": result.entries[:10],
        "player_rank": result.player_rank,
        "player_entry": {"score": result.player_score} if result.player_score else None,
        "total_players": result.total_players
    }

# Include router and setup CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting up - connecting to MongoDB")
    # Create indexes
    await db.episode_scores.create_index([("player_name", 1), ("episode_id", 1)], unique=True)
    await db.episode_scores.create_index([("episode_id", 1), ("score", -1)])
    await db.mixed_scores.create_index("player_name", unique=True)
    await db.mixed_scores.create_index([("score", -1)])
    await db.global_scores.create_index("player_name", unique=True)
    await db.global_scores.create_index([("score", -1)])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
