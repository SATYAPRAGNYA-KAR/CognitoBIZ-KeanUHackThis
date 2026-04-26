"""
ElevenLabs Service — Text-to-speech for morning briefings and voice Q&A responses.
"""

import httpx
import base64
from typing import Optional
from app.config.settings import get_settings

settings = get_settings()

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.elevenlabs_api_key
        self.voice_id = settings.elevenlabs_voice_id or "21m00Tcm4TlvDq8ikWAM"

    @property
    def _headers(self) -> dict:
        return {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.api_key != "")

    async def text_to_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        """Convert text to speech. Returns raw mp3 bytes."""
        if not self._is_configured():
            # Return empty bytes in demo mode — caller handles gracefully
            return b""

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
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.content

    async def text_to_speech_base64(self, text: str) -> Optional[str]:
        """Return base64-encoded mp3, or None if ElevenLabs is not configured."""
        if not self._is_configured():
            return None
        audio_bytes = await self.text_to_speech(text)
        if not audio_bytes:
            return None
        return base64.b64encode(audio_bytes).decode("utf-8")

    async def get_voices(self) -> list:
        if not self._is_configured():
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{ELEVENLABS_BASE}/voices",
                    headers={"xi-api-key": self.api_key},
                )
                resp.raise_for_status()
                return resp.json().get("voices", [])
        except Exception:
            return []

    async def generate_briefing_audio(self, script: str) -> dict:
        """Generate audio for a briefing script. Returns base64 + metadata."""
        try:
            audio_b64 = await self.text_to_speech_base64(script)
            return {
                "audio_base64": audio_b64,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": len(script.split()) * 0.4,
                "script": script,
                "voice_id": self.voice_id,
                "error": None if audio_b64 else "ElevenLabs API key not configured — set ELEVENLABS_API_KEY in .env",
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


# Singleton
elevenlabs_service = ElevenLabsService()