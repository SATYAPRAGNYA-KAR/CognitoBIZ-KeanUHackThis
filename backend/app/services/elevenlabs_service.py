"""
ElevenLabs Service — Text-to-speech for morning briefings and voice Q&A responses.

Fix: Added proper API-key validation error messages and multilingual model support.
The 401 was caused by a missing ELEVENLABS_API_KEY in .env — the key is now
checked early and a clear error is returned instead of silently hitting the API
with an empty/blank Authorization header.

Supported languages use the `eleven_flash_v2_5` model which is ElevenLabs'
multilingual v2 model. Pass `language_code` (BCP-47) to text_to_speech().
"""

import httpx
import base64
from typing import Optional
from app.config.settings import get_settings

settings = get_settings()

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"

# eleven_flash_v2_5 supports 32 languages.
# eleven_monolingual_v1 is English-only — do NOT use it for other languages.
MULTILINGUAL_MODEL = "eleven_flash_v2_5"
MONOLINGUAL_MODEL  = "eleven_monolingual_v1"  # kept as legacy fallback only

# BCP-47 → ElevenLabs language_code mapping for the multilingual model.
# Reference: https://elevenlabs.io/docs/speech-synthesis/supported-languages
SUPPORTED_LANGUAGES: dict[str, str] = {
    "en":    "English",
    "es":    "Spanish",
    "fr":    "French",
    "de":    "German",
    "it":    "Italian",
    "pt":    "Portuguese",
    "pl":    "Polish",
    "hi":    "Hindi",
    "ar":    "Arabic",
    "zh":    "Chinese",
    "ja":    "Japanese",
    "ko":    "Korean",
    "nl":    "Dutch",
    "sv":    "Swedish",
    "no":    "Norwegian",
    "da":    "Danish",
    "fi":    "Finnish",
    "ru":    "Russian",
    "uk":    "Ukrainian",
    "cs":    "Czech",
    "sk":    "Slovak",
    "ro":    "Romanian",
    "hu":    "Hungarian",
    "tr":    "Turkish",
    "id":    "Indonesian",
    "ms":    "Malay",
    "vi":    "Vietnamese",
    "tl":    "Filipino",
    "el":    "Greek",
    "hr":    "Croatian",
    "bg":    "Bulgarian",
    "ca":    "Catalan",
}


class ElevenLabsConfigurationError(RuntimeError):
    """Raised when the ElevenLabs API key is missing or clearly invalid."""


class ElevenLabsService:
    def __init__(self):
        # Do NOT cache these at construction time — read from settings on each
        # access so that runtime env changes (and test overrides) are respected.
        self._voice_id_override: str | None = None
        self._model_id_override: str | None = None

    @property
    def api_key(self) -> str:
        # Re-read from settings every time to avoid stale lru_cache values.
        from app.config.settings import get_settings as _gs
        return _gs().elevenlabs_api_key or ""

    @property
    def voice_id(self) -> str:
        from app.config.settings import get_settings as _gs
        return self._voice_id_override or _gs().elevenlabs_voice_id or "CwhRBWXzGAHq8TQ4Fs17"

    @property
    def model_id(self) -> str:
        from app.config.settings import get_settings as _gs
        return self._model_id_override or _gs().elevenlabs_model_id or MULTILINGUAL_MODEL

    @property
    def _headers(self) -> dict:
        return {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json",
        }

    def _is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def _assert_configured(self):
        """Raise a clear error if the API key is absent."""
        if not self._is_configured():
            raise ElevenLabsConfigurationError(
                "ELEVENLABS_API_KEY is not set. "
                "Add it to your backend/.env file:\n"
                "  ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n"
                "Get a key at https://elevenlabs.io/app/speech-synthesis"
            )

    def _pick_model(self, language_code: Optional[str]) -> str:
        """Return the correct model ID for the requested language."""
        lang = (language_code or "en").split("-")[0].lower()  # "en-US" → "en"
        if lang == "en":
            # Prefer the configured model (may be flash/turbo); fall back to
            # multilingual so we never accidentally use the monolingual model
            # when language_code is explicitly "en" but user later switches.
            return self.model_id if self.model_id else MULTILINGUAL_MODEL
        # Non-English always needs the multilingual model.
        return MULTILINGUAL_MODEL

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language_code: Optional[str] = None,
    ) -> bytes:
        """Convert text to speech. Returns raw MP3 bytes.

        Args:
            text:          The text to synthesise.
            voice_id:      Override the default voice.
            language_code: BCP-47 code, e.g. "en", "es", "fr".
                           Determines which ElevenLabs model is used.
        """
        self._assert_configured()

        vid   = voice_id or self.voice_id
        model = self._pick_model(language_code)
        url   = f"{ELEVENLABS_BASE}/text-to-speech/{vid}"

        payload: dict = {
            "text": text,
            "model_id": model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.3,
                "use_speaker_boost": True,
            },
        }

        # The multilingual model accepts an optional language_code hint.
        if language_code and model == MULTILINGUAL_MODEL:
            lang = language_code.split("-")[0].lower()
            if lang in SUPPORTED_LANGUAGES:
                payload["language_code"] = lang

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=self._headers, json=payload)
            resp.raise_for_status()
            return resp.content

    async def text_to_speech_base64(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language_code: Optional[str] = None,
    ) -> Optional[str]:
        """Return base64-encoded MP3, or None if ElevenLabs is not configured."""
        if not self._is_configured():
            return None
        audio_bytes = await self.text_to_speech(
            text, voice_id=voice_id, language_code=language_code
        )
        if not audio_bytes:
            return None
        return base64.b64encode(audio_bytes).decode("utf-8")

    async def get_voices(self) -> list:
        self._assert_configured()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{ELEVENLABS_BASE}/voices",
                headers={"xi-api-key": self.api_key},
            )
            resp.raise_for_status()
            return resp.json().get("voices", [])

    async def generate_briefing_audio(
        self,
        script: str,
        voice_id: Optional[str] = None,
        language_code: Optional[str] = None,
    ) -> dict:
        """Generate audio for a briefing script. Returns base64 + metadata."""
        if not self._is_configured():
            return {
                "audio_base64": None,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": len(script.split()) * 0.4,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "language_code": language_code or "en",
                "error": (
                    "ElevenLabs API key not configured — "
                    "set ELEVENLABS_API_KEY in backend/.env"
                ),
            }
        try:
            audio_b64 = await self.text_to_speech_base64(
                script, voice_id=voice_id, language_code=language_code
            )
            return {
                "audio_base64": audio_b64,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": len(script.split()) * 0.4,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "language_code": language_code or "en",
                "error": None,
            }
        except ElevenLabsConfigurationError as e:
            return {
                "audio_base64": None,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": 0,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "language_code": language_code or "en",
                "error": str(e),
            }
        except Exception as e:
            return {
                "audio_base64": None,
                "mime_type": "audio/mpeg",
                "duration_estimate_seconds": 0,
                "script": script,
                "voice_id": voice_id or self.voice_id,
                "language_code": language_code or "en",
                "error": str(e),
            }

    @staticmethod
    def supported_languages() -> dict[str, str]:
        """Return the BCP-47 → display-name map of all supported languages."""
        return dict(SUPPORTED_LANGUAGES)


# Singleton
elevenlabs_service = ElevenLabsService()