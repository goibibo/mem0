# OpenMemory API

This directory contains the backend API for OpenMemory, built with FastAPI and SQLAlchemy. This also runs the Mem0 MCP Server that you can use with MCP clients to remember things.

## Quick Start with Docker (Recommended)

The easiest way to get started is using Docker. Make sure you have Docker and Docker Compose installed.

1. Build the containers:
```bash
make build
```

2. Create `.env` file:
```bash
make env
```

Once you run this command, edit the file `api/.env` and enter your API keys.

3. Start the services:
```bash
make up
```

The API will be available at `http://localhost:8765`

### Common Docker Commands

- View logs: `make logs`
- Open shell in container: `make shell`
- Run database migrations: `make migrate`
- Run tests: `make test`
- Run tests and clean up: `make test-clean`
- Stop containers: `make down`

## LLM Configuration

The OpenMemory API supports multiple LLM providers for memory operations and semantic search. You can configure different providers for LLM and embedding models.

### Supported LLM Providers

The API supports **18 LLM providers**:

| Provider | Description | Configuration |
|----------|-------------|---------------|
| `openai` | OpenAI GPT models (default) | API key, model, temperature, etc. |
| `anthropic` | Claude models | API key, model, temperature, etc. |
| `gemini` | Google Gemini | API key, model, temperature, etc. |
| `groq` | Groq inference | API key, model, temperature, etc. |
| `ollama` | Local Ollama models | Base URL, model, temperature, etc. |
| `together` | Together AI | API key, model, temperature, etc. |
| `aws_bedrock` | AWS Bedrock models | AWS credentials, model, etc. |
| `azure_openai` | Azure OpenAI | Azure credentials, deployment, etc. |
| `litellm` | LiteLLM proxy | API key, model, temperature, etc. |
| `deepseek` | DeepSeek models | API key, model, temperature, etc. |
| `xai` | xAI models | API key, model, temperature, etc. |
| `sarvam` | Sarvam AI | API key, model, temperature, etc. |
| `lmstudio` | LM Studio local server | Base URL, model, temperature, etc. |
| `vllm` | vLLM inference server | Base URL, model, temperature, etc. |
| `langchain` | LangChain integration | LangChain model instance |
| `openai_structured` | OpenAI with structured output | API key, model, temperature, etc. |
| `azure_openai_structured` | Azure OpenAI with structured output | Azure credentials, deployment, etc. |

### Supported Embedding Providers

The API supports **10 embedding providers**:

| Provider | Description | Configuration |
|----------|-------------|---------------|
| `openai` | OpenAI embeddings (default) | API key, model |
| `ollama` | Ollama embeddings | Base URL, model |
| `huggingface` | HuggingFace models | Model name, device |
| `azure_openai` | Azure OpenAI embeddings | Azure credentials, deployment |
| `gemini` | Google Gemini embeddings | API key, model |
| `vertexai` | Google Vertex AI | Google Cloud credentials, model |
| `together` | Together AI embeddings | API key, model |
| `lmstudio` | LM Studio embeddings | Base URL, model |
| `langchain` | LangChain embeddings | LangChain embedder instance |
| `aws_bedrock` | AWS Bedrock embeddings | AWS credentials, model |

### Environment Variables for LLM Configuration

The API uses environment variables to configure LLM and embedding providers. You can set these in your `.env` file:

#### LLM Configuration
- `LLM_PROVIDER`: The LLM provider to use (default: `openai`)
- `LLM_MODEL`: The model to use (default: `gpt-4o-mini`)
- `LLM_API_KEY`: API key for the LLM provider
- `LLM_TEMPERATURE`: Temperature setting (default: `0.1`)
- `LLM_MAX_TOKENS`: Maximum tokens to generate (default: `2000`)

#### Azure OpenAI Specific
- `LLM_AZURE_DEPLOYMENT`: Azure deployment name
- `LLM_AZURE_ENDPOINT`: Azure endpoint URL
- `LLM_AZURE_API_VERSION`: Azure API version

#### Embedding Configuration
- `EMBEDDER_PROVIDER`: The embedding provider to use (default: `openai`)
- `EMBEDDER_MODEL`: The embedding model to use (default: `text-embedding-3-small`)
- `EMBEDDER_API_KEY`: API key for the embedding provider

#### Azure OpenAI Embedding Specific
- `EMBEDDER_AZURE_DEPLOYMENT`: Azure deployment name for embeddings
- `EMBEDDER_AZURE_ENDPOINT`: Azure endpoint URL for embeddings
- `EMBEDDER_AZURE_API_VERSION`: Azure API version for embeddings

### Configuration Examples

#### OpenAI Configuration (Default)
```bash
# .env file
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-your-openai-api-key
LLM_TEMPERATURE=0.1
LLM_MAX_TOKENS=2000

EMBEDDER_PROVIDER=openai
EMBEDDER_MODEL=text-embedding-3-small
EMBEDDER_API_KEY=sk-your-openai-api-key
```

#### Azure OpenAI Configuration
```bash
# .env file
LLM_PROVIDER=azure_openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-azure-api-key
LLM_AZURE_DEPLOYMENT=your-deployment-name
LLM_AZURE_ENDPOINT=https://your-resource.openai.azure.com/
LLM_AZURE_API_VERSION=2024-02-01

EMBEDDER_PROVIDER=azure_openai
EMBEDDER_MODEL=text-embedding-3-small
EMBEDDER_API_KEY=your-azure-api-key
EMBEDDER_AZURE_DEPLOYMENT=your-embedding-deployment
EMBEDDER_AZURE_ENDPOINT=https://your-resource.openai.azure.com/
EMBEDDER_AZURE_API_VERSION=2024-02-01
```

## Database Configuration

The API supports both SQLite (for development) and MySQL (for production). The database is automatically selected based on the `ENV` environment variable.

### Environment Variables

- `ENV`: Set to `dev` for development (uses SQLite) or `prod` for production (uses MySQL)
- `USER`: User ID to associate memories with (default: `default_user`)

#### Development (SQLite) - When ENV=dev
- `DATABASE_URL`: Optional, defaults to `sqlite:///./openmemory.db`

#### Production (MySQL) - When ENV=prod
- `MYSQL_HOST`: MySQL server host (default: `localhost`)
- `MYSQL_PORT`: MySQL server port (default: `3306`)
- `MYSQL_USER`: MySQL username (default: `root`)
- `MYSQL_PASSWORD`: MySQL password (required)
- `MYSQL_DATABASE`: MySQL database name (default: `openmemory`)
- `DATABASE_URL`: Alternatively, provide a full connection string to override individual MySQL parameters

## Vector Store Configuration

The API uses Qdrant as the default vector store for storing memory embeddings. You can configure it using environment variables:

- `QDRANT_HOST`: Qdrant server host (default: `localhost`)

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: `http://localhost:8765/docs`
- ReDoc: `http://localhost:8765/redoc`

## Project Structure

- `app/`: Main application code
  - `models.py`: Database models
  - `database.py`: Database configuration
  - `routers/`: API route handlers
  - `utils/`: Utility functions including configuration parsing
- `migrations/`: Database migration files
- `tests/`: Test files
- `alembic/`: Alembic migration configuration
- `main.py`: Application entry point
- `config.json`: Configuration file
- `default_config.json`: Default configuration template

## Development Guidelines

- Follow PEP 8 style guide
- Use type hints
- Write tests for new features
- Update documentation when making changes
- Run migrations for database changes
