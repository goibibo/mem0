import logging
from typing import List

from app.utils.prompts import MEMORY_CATEGORIZATION_PROMPT
from app.utils.parse_config import get_parsed_config
from mem0.utils.factory import LlmFactory

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

load_dotenv()
config = get_parsed_config()
llm_client = LlmFactory.create(config["llm"]["provider"], config["llm"]["config"])

class MemoryCategories(BaseModel):
    categories: List[str]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=15))
def get_categories_for_memory(memory: str) -> List[str]:
    try:
        messages = [
            {"role": "system", "content": MEMORY_CATEGORIZATION_PROMPT},
            {"role": "user", "content": memory}
        ]

        # Use JSON response format instead of Pydantic model
        completion = llm_client.generate_response(
            messages=messages,
            response_format={"type": "json_object"}
        )

        # Parse the JSON response manually
        import json
        try:
            # Handle case where response might be a string or already parsed
            if isinstance(completion, str):
                response_data = json.loads(completion)
            else:
                # If it's already a dict/object, use it directly
                response_data = completion
            
            # Extract categories from the response
            if isinstance(response_data, dict) and "categories" in response_data:
                categories = response_data["categories"]
            else:
                # Fallback: try to extract categories from the response
                categories = response_data.get("categories", [])
            
            if not categories:
                logging.warning(f"No categories found in response: {response_data}")
                return []
            
            return [cat.strip().lower() for cat in categories if cat]

        except json.JSONDecodeError as json_e:
            logging.error(f"Failed to parse JSON response: {json_e}")
            logging.debug(f"Raw response: {completion}")
            return []

    except Exception as e:
        logging.error(f"[ERROR] Failed to get categories: {e}")
        try:
            logging.debug(f"[DEBUG] Raw response: {completion}")
        except Exception as debug_e:
            logging.debug(f"[DEBUG] Could not extract raw response: {debug_e}")
        return []
