"""ElevenLabs service for text-to-speech and voice discovery."""

import base64
from typing import Optional

import httpx

from app.config.settings import get_settings

settings = get_settings()

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
FALLBACK_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"



class ElevenLabsConfigurationError(RuntimeError):
    pass


class ElevenLabsService:
    def __init__(self):
        self.api_key = settings.elevenlabs_api_key
        self.voice_id = settings.elevenlabs_voice_id
        self.model_id = settings.elevenlabs_model_id
        self.headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def _require_config(self) -> None:
        if not self.api_key:
            raise ElevenLabsConfigurationError("ELEVENLABS_API_KEY is not configured.")
        if not self.voice_id:
            raise ElevenLabsConfigurationError("ELEVENLABS_VOICE_ID is not configured.")

    async def text_to_speech(self, text: str, voice_id: Optional[str] = None) -> bytes:
        self._require_config()
        vid = voice_id or self.voice_id
        try:
            return await self._text_to_speech_request(text, vid)
        except RuntimeError as exc:
            message = str(exc)
            if vid != FALLBACK_VOICE_ID and ("paid_plan_required" in message or "Free users cannot use library voices" in message):
                return await self._text_to_speech_request(text, FALLBACK_VOICE_ID)
            raise

    async def _text_to_speech_request(self, text: str, voice_id: str) -> bytes:
        url = f"{ELEVENLABS_BASE}/text-to-speech/{voice_id}"
        payload = {
            "text": text,
            "model_id": self.model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3,
                "use_speaker_boost": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, headers=self.headers, json=payload)
                response.raise_for_status()
                return response.content
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"ElevenLabs API error: {exc.response.status_code} - {exc.response.text}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"ElevenLabs request failed: {exc}") from exc

    async def text_to_speech_base64(self, text: str, voice_id: Optional[str] = None) -> str:
        audio_bytes = await self.text_to_speech(text, voice_id=voice_id)
        return base64.b64encode(audio_bytes).decode("utf-8")

    async def get_voices(self) -> list[dict]:
        self._require_config()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{ELEVENLABS_BASE}/voices",
                    headers={"xi-api-key": self.api_key},
                )
                response.raise_for_status()
                data = response.json()
                return data.get("voices", [])
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(
                f"ElevenLabs API error: {exc.response.status_code} - {exc.response.text}"
            ) from exc
        except Exception as exc:
            raise RuntimeError(f"ElevenLabs request failed: {exc}") from exc

    async def generate_briefing_audio(self, script: str, voice_id: Optional[str] = None) -> dict:
        try:
            audio_b64 = await self.text_to_speech_base64(script, voice_id=voice_id)
            return {
                "audio_base64": audio_b64,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": len(script.split()) * 0.4,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "model_id": self.model_id,
            }
        except Exception as exc:
            return {
                "audio_base64": None,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": 0,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "model_id": self.model_id,
                "error": str(exc),
            }


elevenlabs_service = ElevenLabsService()
