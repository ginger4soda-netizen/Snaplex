use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextEmbeddingConfig {
    #[serde(default)]
    pub enabled: bool,
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub dimensions: Option<u16>,
}

impl TextEmbeddingConfig {
    pub fn normalized(self) -> Option<Self> {
        if !self.enabled {
            return None;
        }

        let endpoint = self.endpoint.trim().trim_end_matches('/').to_string();
        let api_key = self.api_key.trim().to_string();
        let model = self.model.trim().to_string();

        if endpoint.is_empty() || api_key.is_empty() || model.is_empty() {
            return None;
        }

        Some(Self {
            enabled: true,
            endpoint,
            api_key,
            model,
            dimensions: self.dimensions,
        })
    }

    pub fn model_version(&self) -> String {
        match self.dimensions {
            Some(dimensions) => format!(
                "openai-compatible:{}:{}:{}",
                self.endpoint.trim_end_matches('/'),
                self.model,
                dimensions
            ),
            None => format!(
                "openai-compatible:{}:{}",
                self.endpoint.trim_end_matches('/'),
                self.model
            ),
        }
    }

    fn embeddings_url(&self) -> String {
        let endpoint = self.endpoint.trim().trim_end_matches('/');
        if endpoint.ends_with("/embeddings") {
            endpoint.to_string()
        } else {
            format!("{endpoint}/embeddings")
        }
    }
}

pub trait TextEmbedder {
    fn model_version(&self) -> &str;
    fn encode(&self, input: &str) -> Result<Vec<f32>>;
}

#[derive(Debug, Error)]
pub enum TextEmbedderError {
    #[error("text embedding input must not be empty")]
    EmptyInput,
    #[error("text embedding request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("text embedding API returned invalid JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("text embedding API returned status {status}: {message}")]
    Api { status: u16, message: String },
    #[error("text embedding API returned no embedding vector")]
    MissingEmbedding,
    #[error("text embedding API returned an empty embedding vector")]
    EmptyEmbedding,
}

pub type Result<T> = std::result::Result<T, TextEmbedderError>;

pub struct OpenAiCompatibleTextEmbedder {
    config: TextEmbeddingConfig,
    model_version: String,
    transport: ReqwestEmbeddingTransport,
}

impl OpenAiCompatibleTextEmbedder {
    pub fn new(config: TextEmbeddingConfig) -> Result<Self> {
        Self::with_transport(config, ReqwestEmbeddingTransport::new()?)
    }
}

#[cfg(test)]
struct OpenAiCompatibleTextEmbedderWithTransport<T> {
    config: TextEmbeddingConfig,
    model_version: String,
    transport: T,
}

#[cfg(test)]
impl<T> OpenAiCompatibleTextEmbedderWithTransport<T>
where
    T: EmbeddingTransport,
{
    fn with_transport(config: TextEmbeddingConfig, transport: T) -> Result<Self> {
        let model_version = config.model_version();

        Ok(Self {
            config,
            model_version,
            transport,
        })
    }
}

impl OpenAiCompatibleTextEmbedder {
    fn with_transport(
        config: TextEmbeddingConfig,
        transport: ReqwestEmbeddingTransport,
    ) -> Result<Self> {
        let model_version = config.model_version();

        Ok(Self {
            config,
            model_version,
            transport,
        })
    }
}

impl TextEmbedder for OpenAiCompatibleTextEmbedder {
    fn model_version(&self) -> &str {
        &self.model_version
    }

    fn encode(&self, input: &str) -> Result<Vec<f32>> {
        encode_with_transport(&self.config, &self.model_version, &self.transport, input)
    }
}

#[cfg(test)]
impl<T> TextEmbedder for OpenAiCompatibleTextEmbedderWithTransport<T>
where
    T: EmbeddingTransport,
{
    fn model_version(&self) -> &str {
        &self.model_version
    }

    fn encode(&self, input: &str) -> Result<Vec<f32>> {
        encode_with_transport(&self.config, &self.model_version, &self.transport, input)
    }
}

fn encode_with_transport(
    config: &TextEmbeddingConfig,
    _model_version: &str,
    transport: &dyn EmbeddingTransport,
    input: &str,
) -> Result<Vec<f32>> {
    let input = input.trim();
    if input.is_empty() {
        return Err(TextEmbedderError::EmptyInput);
    }

    let mut body = EmbeddingRequest {
        input,
        model: config.model.as_str(),
        encoding_format: "float",
        dimensions: config.dimensions,
    };

    if body.dimensions == Some(0) {
        body.dimensions = None;
    }

    let response = transport.post_embeddings(&config.embeddings_url(), &config.api_key, &body)?;

    if !(200..300).contains(&response.status) {
        let error = serde_json::from_str::<EmbeddingErrorResponse>(&response.body).ok();
        let message = error
            .and_then(|error| error.error.map(|error| error.message))
            .unwrap_or_else(|| response.reason.unwrap_or_else(|| "API error".to_string()));

        return Err(TextEmbedderError::Api {
            status: response.status,
            message,
        });
    }

    let response = serde_json::from_str::<EmbeddingResponse>(&response.body)?;
    let mut embedding = response
        .data
        .into_iter()
        .min_by_key(|embedding| embedding.index)
        .map(|embedding| embedding.embedding)
        .ok_or(TextEmbedderError::MissingEmbedding)?;

    if embedding.is_empty() {
        return Err(TextEmbedderError::EmptyEmbedding);
    }

    Ok(std::mem::take(&mut embedding))
}

trait EmbeddingTransport {
    fn post_embeddings(
        &self,
        url: &str,
        api_key: &str,
        request: &EmbeddingRequest<'_>,
    ) -> Result<EmbeddingHttpResponse>;
}

struct EmbeddingHttpResponse {
    status: u16,
    reason: Option<String>,
    body: String,
}

struct ReqwestEmbeddingTransport {
    client: reqwest::blocking::Client,
}

impl ReqwestEmbeddingTransport {
    fn new() -> Result<Self> {
        Ok(Self {
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()?,
        })
    }
}

impl EmbeddingTransport for ReqwestEmbeddingTransport {
    fn post_embeddings(
        &self,
        url: &str,
        api_key: &str,
        request: &EmbeddingRequest<'_>,
    ) -> Result<EmbeddingHttpResponse> {
        let response = self
            .client
            .post(url)
            .bearer_auth(api_key)
            .json(request)
            .send()?;
        let status = response.status();
        let reason = status.canonical_reason().map(str::to_string);
        let body = response.text()?;

        Ok(EmbeddingHttpResponse {
            status: status.as_u16(),
            reason,
            body,
        })
    }
}

#[derive(Debug, Serialize)]
struct EmbeddingRequest<'a> {
    input: &'a str,
    model: &'a str,
    encoding_format: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    dimensions: Option<u16>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Debug, Deserialize)]
struct EmbeddingErrorResponse {
    error: Option<EmbeddingError>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingError {
    message: String,
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use super::{
        EmbeddingHttpResponse, EmbeddingRequest, EmbeddingTransport,
        OpenAiCompatibleTextEmbedderWithTransport, TextEmbedder, TextEmbedderError,
        TextEmbeddingConfig,
    };

    struct FakeTransport {
        response: RefCell<Option<EmbeddingHttpResponse>>,
        seen_url: RefCell<Option<String>>,
        seen_api_key: RefCell<Option<String>>,
        seen_body: RefCell<Option<String>>,
    }

    impl FakeTransport {
        fn ok(body: &str) -> Self {
            Self {
                response: RefCell::new(Some(EmbeddingHttpResponse {
                    status: 200,
                    reason: Some("OK".to_string()),
                    body: body.to_string(),
                })),
                seen_url: RefCell::new(None),
                seen_api_key: RefCell::new(None),
                seen_body: RefCell::new(None),
            }
        }

        fn error(status: u16, reason: &str, body: &str) -> Self {
            Self {
                response: RefCell::new(Some(EmbeddingHttpResponse {
                    status,
                    reason: Some(reason.to_string()),
                    body: body.to_string(),
                })),
                seen_url: RefCell::new(None),
                seen_api_key: RefCell::new(None),
                seen_body: RefCell::new(None),
            }
        }
    }

    impl EmbeddingTransport for FakeTransport {
        fn post_embeddings(
            &self,
            url: &str,
            api_key: &str,
            request: &EmbeddingRequest<'_>,
        ) -> super::Result<EmbeddingHttpResponse> {
            self.seen_url.replace(Some(url.to_string()));
            self.seen_api_key.replace(Some(api_key.to_string()));
            self.seen_body
                .replace(Some(serde_json::to_string(request).unwrap()));
            Ok(self.response.borrow_mut().take().unwrap())
        }
    }

    fn enabled_config(endpoint: String) -> TextEmbeddingConfig {
        TextEmbeddingConfig {
            enabled: true,
            endpoint,
            api_key: "test-key".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: Some(3),
        }
    }

    #[test]
    fn disabled_or_incomplete_config_normalizes_to_none() {
        assert!(TextEmbeddingConfig {
            enabled: false,
            endpoint: "https://api.openai.com/v1".to_string(),
            api_key: "sk-test".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: None,
        }
        .normalized()
        .is_none());

        assert!(TextEmbeddingConfig {
            enabled: true,
            endpoint: "https://api.openai.com/v1".to_string(),
            api_key: "".to_string(),
            model: "text-embedding-3-small".to_string(),
            dimensions: None,
        }
        .normalized()
        .is_none());
    }

    #[test]
    fn openai_compatible_embedder_posts_embeddings_request() {
        let endpoint = "https://api.example.test/v1".to_string();
        let transport = FakeTransport::ok(r#"{"data":[{"index":0,"embedding":[1.0,0.0,0.5]}]}"#);
        let embedder = OpenAiCompatibleTextEmbedderWithTransport::with_transport(
            enabled_config(endpoint.clone()),
            transport,
        )
        .unwrap();
        let embedding = embedder.encode("sunset harbor").unwrap();

        assert_eq!(
            embedder.transport.seen_url.take().unwrap(),
            "https://api.example.test/v1/embeddings"
        );
        assert_eq!(embedder.transport.seen_api_key.take().unwrap(), "test-key");
        assert_eq!(
            embedder.transport.seen_body.take().unwrap(),
            r#"{"input":"sunset harbor","model":"text-embedding-3-small","encoding_format":"float","dimensions":3}"#
        );
        assert_eq!(
            embedder.model_version(),
            format!("openai-compatible:{endpoint}:text-embedding-3-small:3")
        );
        assert_eq!(embedding, vec![1.0, 0.0, 0.5]);
    }

    #[test]
    fn openai_compatible_embedder_maps_api_errors() {
        let transport =
            FakeTransport::error(401, "Unauthorized", r#"{"error":{"message":"bad key"}}"#);
        let embedder = OpenAiCompatibleTextEmbedderWithTransport::with_transport(
            enabled_config("https://api.example.test/v1".to_string()),
            transport,
        )
        .unwrap();
        let err = embedder.encode("sunset harbor").unwrap_err();

        assert!(matches!(
            err,
            TextEmbedderError::Api {
                status: 401,
                message
            } if message == "bad key"
        ));
    }
}
