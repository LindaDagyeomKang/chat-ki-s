from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    chroma_host: str = "http://localhost:8000"
    openai_api_key: str = ""
    collection_name: str = "chat_ki_s_docs"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    top_k: int = 5
    # LLM settings
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.1
    llm_max_tokens: int = 512
    llm_top_p: float = 0.9
    # Relevance thresholds
    score_threshold_high: float = 0.70
    score_threshold_low: float = 0.35

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
