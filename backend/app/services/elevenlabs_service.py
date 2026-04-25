"""
ElevenLabs Service — Text-to-speech for morning briefings and voice Q&A responses.
"""

import httpx
import base64
from app.config.settings import get_settings
from typing import Optional

settings = get_settings()

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.elevenlabs_api_key
        self.voice_id = settings.elevenlabs_voice_id
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    async def text_to_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Convert text to speech audio. Returns raw audio bytes (mp3)."""
        vid = voice_id or self.voice_id
        url = f"{ELEVENLABS_BASE}/text-to-speech/{vid}"

        payload = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3,
                "use_speaker_boost": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=self.headers, json=payload)
                resp.raise_for_status()
                return resp.content
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"ElevenLabs API error: {e.response.status_code} — {e.response.text}")
        except Exception as e:
            raise RuntimeError(f"ElevenLabs request failed: {str(e)}")

    async def text_to_speech_base64(self, text: str) -> str:
        """Convert text to speech and return as base64-encoded string for JSON responses."""
        audio_bytes = await self.text_to_speech(text)
        return base64.b64encode(audio_bytes).decode("utf-8")

    async def get_voices(self) -> list:
        """List available voices."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{ELEVENLABS_BASE}/voices",
                    headers={"xi-api-key": self.api_key},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("voices", [])
        except Exception as e:
            return []

    async def generate_briefing_audio(self, script: str) -> dict:
        """Generate morning briefing audio. Returns base64 audio + metadata."""
        try:
            audio_b64 = await self.text_to_speech_base64(script)
            return {
                "audio_base64": audio_b64,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": len(script.split()) * 0.4,  # ~150 WPM
                "script": script,
                "voice_id": self.voice_id,
            }
        except Exception as e:
            return {
                "audio_base64": None,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": 0,
                "script": script,
                "voice_id": self.voice_id,
                "error": str(e),
            }


# Fix missing import
from typing import Optional

# Singleton
elevenlabs_service = ElevenLabsService()