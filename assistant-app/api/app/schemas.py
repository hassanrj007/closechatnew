"""Request and response models shared by the API routes."""

import base64
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Role = Literal["system", "user", "assistant"]
IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
TEXT_MEDIA_TYPES = {"application/json", "application/xml", "application/yaml", "application/x-yaml"}
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024


class ChatAttachment(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    media_type: str = Field(max_length=100)
    size: int = Field(ge=0, le=MAX_ATTACHMENT_BYTES)
    data: str | None = Field(default=None, max_length=7_000_000)
    text: str | None = Field(default=None, max_length=200_000)

    @model_validator(mode="after")
    def validate_payload(self) -> "ChatAttachment":
        if self.media_type in IMAGE_MEDIA_TYPES:
            if self.data is None or self.text is not None:
                raise ValueError("Image attachments require base64 data only")
            try:
                decoded = base64.b64decode(self.data, validate=True)
            except ValueError as exc:
                raise ValueError("Image attachment data must be valid base64") from exc
            if len(decoded) != self.size:
                raise ValueError("Image attachment size does not match its data")
        elif self.media_type.startswith("text/") or self.media_type in TEXT_MEDIA_TYPES:
            if self.text is None or self.data is not None:
                raise ValueError("Text attachments require text content only")
            if self.size > 1024 * 1024:
                raise ValueError("Text attachments must be 1 MiB or smaller")
        else:
            raise ValueError("Only common image and text file types are supported")
        return self


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(max_length=200_000)
    attachments: list[ChatAttachment] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def validate_attachment_total(self) -> "ChatMessage":
        if sum(attachment.size for attachment in self.attachments) > MAX_MESSAGE_ATTACHMENT_BYTES:
            raise ValueError("Attachments must total 10 MiB or less per message")
        return self


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    provider: str | None = Field(
        default=None, description="Provider id, e.g. 'ollama' or 'openai'. Omit for automatic."
    )
    model: str | None = Field(default=None, description="Model id within the provider.")
    temperature: float | None = Field(default=None, ge=0, le=2)


class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    local: bool
    size_bytes: int | None = None
    parameter_size: str | None = None
    family: str | None = None


class ProviderStatus(BaseModel):
    id: str
    label: str
    local: bool
    configured: bool
    available: bool
    error: str | None = None
    models: list[ModelInfo] = Field(default_factory=list)


class ModelsResponse(BaseModel):
    providers: list[ProviderStatus]
    default: ModelInfo | None = None
    has_local_models: bool


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str
