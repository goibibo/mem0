import os

def get_default_memory_config():
    """Get default memory client configuration with sensible defaults."""
    return {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": "openmemory",
                "host": "env:QDRANT_HOST",
                "port": 6333,
            }
        },
        "llm": {
            "provider": "env:LLM_PROVIDER",
            "config": {
                "model": "env:LLM_MODEL",
                "temperature": 0.1,
                "max_tokens": 2000,
                "api_key": "env:LLM_API_KEY",
                "azure_kwargs": {
                    "api_key": "env:LLM_API_KEY",
                    "azure_deployment": "env:LLM_AZURE_DEPLOYMENT",
                    "azure_endpoint": "env:LLM_AZURE_ENDPOINT",
                    "api_version": "env:LLM_AZURE_API_VERSION",
                }
            }
        },
        "embedder": {
            "provider": "env:EMBEDDER_PROVIDER",
            "config": {
                "model": "env:EMBEDDER_MODEL",
                "api_key": "env:EMBEDDER_API_KEY",
                "azure_kwargs": {
                    "api_key": "env:EMBEDDER_API_KEY",
                    "azure_deployment": "env:EMBEDDER_AZURE_DEPLOYMENT",
                    "azure_endpoint": "env:EMBEDDER_AZURE_ENDPOINT",
                    "api_version": "env:EMBEDDER_AZURE_API_VERSION",
                }
            }
        },
        "version": "v1.1"
    }


def _parse_environment_variables(config_dict):
    """
    Parse environment variables in config values.
    Converts 'env:VARIABLE_NAME' to actual environment variable values.
    """
    if isinstance(config_dict, dict):
        parsed_config = {}
        for key, value in config_dict.items():
            if isinstance(value, str) and value.startswith("env:"):
                env_var = value.split(":", 1)[1]
                env_value = os.environ.get(env_var)
                if env_value:
                    parsed_config[key] = env_value
                    print(f"Loaded {env_var} from environment for {key}")
                else:
                    print(f"Warning: Environment variable {env_var} not found, keeping original value")
                    parsed_config[key] = value
            elif isinstance(value, dict):
                parsed_config[key] = _parse_environment_variables(value)
            else:
                parsed_config[key] = value
        return parsed_config
    return config_dict


def get_parsed_config():
    config = get_default_memory_config()
    return _parse_environment_variables(config)