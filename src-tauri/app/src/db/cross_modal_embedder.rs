use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use ort::value::Tensor;
use tauri::Manager;
use thiserror::Error;

pub trait CrossModalEmbedder {
    fn model_version(&self) -> &str;
    fn encode_text(&self, input: &str) -> Result<Vec<f32>>;
    fn encode_image(&self, path: &Path) -> Result<Vec<f32>>;
}

#[derive(Debug, Error)]
pub enum CrossModalEmbedderError {
    #[error("cross-modal text embedding input must not be empty")]
    EmptyTextInput,
    #[error("cross-modal image path does not exist: {0}")]
    ImageNotFound(String),
    #[error("cross-modal image file error: {0}")]
    ImageIo(std::io::Error),
    #[error("cross-modal image embedding failed: {0}")]
    Image(#[from] image::ImageError),
    #[error("cross-modal vector must not be empty")]
    EmptyVector,
    #[error("CLIP model file is missing: {0}")]
    ModelNotFound(String),
    #[error("CLIP inference failed: {0}")]
    Ort(#[from] ort::Error),
    #[error("CLIP output {0} is missing")]
    MissingOutput(&'static str),
    #[error("CLIP tokenizer file error: {0}")]
    Io(#[from] std::io::Error),
    #[error("CLIP tokenizer JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("CLIP tokenizer is missing token: {0}")]
    MissingToken(String),
}

pub type Result<T> = std::result::Result<T, CrossModalEmbedderError>;

pub struct ClipOnnxEmbedder {
    session: Mutex<ort::session::Session>,
    tokenizer: ClipTokenizer,
    model_version: String,
}

impl ClipOnnxEmbedder {
    pub const MODEL_VERSION: &'static str =
        "clip-vit-b-32-int8:openai-clip-vit-base-patch32:sha256-4ac011172c8c022937bb83dad2e8fc207f52f19972b36e14808cc3c8042c4e60";

    pub fn from_model_file(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Err(CrossModalEmbedderError::ModelNotFound(
                path.display().to_string(),
            ));
        }

        let session = ort::session::Session::builder()?.commit_from_file(path)?;
        let tokenizer_dir = path.parent().unwrap_or_else(|| Path::new("."));
        let tokenizer = ClipTokenizer::from_dir(tokenizer_dir)?;

        Ok(Self {
            session: Mutex::new(session),
            tokenizer,
            model_version: Self::MODEL_VERSION.to_string(),
        })
    }
}

impl CrossModalEmbedder for ClipOnnxEmbedder {
    fn model_version(&self) -> &str {
        &self.model_version
    }

    fn encode_text(&self, input: &str) -> Result<Vec<f32>> {
        let input = input.trim();
        if input.is_empty() {
            return Err(CrossModalEmbedderError::EmptyTextInput);
        }

        let encoded = self.tokenizer.encode(input)?;
        let input_ids = Tensor::from_array(([1_usize, 77_usize], encoded.input_ids))?;
        let attention_mask = Tensor::from_array(([1_usize, 77_usize], encoded.attention_mask))?;
        let pixel_values = Tensor::from_array((
            [1_usize, 3_usize, 224_usize, 224_usize],
            vec![0.0_f32; 3 * 224 * 224].into_boxed_slice(),
        ))?;

        let mut session = self.session.lock().unwrap();
        let outputs = session.run(ort::inputs! {
            "input_ids" => input_ids,
            "pixel_values" => pixel_values,
            "attention_mask" => attention_mask,
        })?;
        let value = outputs
            .get("text_embeds")
            .ok_or(CrossModalEmbedderError::MissingOutput("text_embeds"))?;
        let (_, data) = value.try_extract_tensor::<f32>()?;

        let vector = normalize_vector(data);
        if vector.is_empty() {
            return Err(CrossModalEmbedderError::EmptyVector);
        }

        Ok(vector)
    }

    fn encode_image(&self, path: &Path) -> Result<Vec<f32>> {
        let pixel_values = preprocess_clip_image(path)?;
        let input_ids = Tensor::from_array(([1_usize, 77_usize], dummy_tokens()))?;
        let attention_mask = Tensor::from_array(([1_usize, 77_usize], dummy_attention()))?;
        let pixel_values = Tensor::from_array((
            [1_usize, 3_usize, 224_usize, 224_usize],
            pixel_values.into_boxed_slice(),
        ))?;

        let mut session = self.session.lock().unwrap();
        let outputs = session.run(ort::inputs! {
            "input_ids" => input_ids,
            "pixel_values" => pixel_values,
            "attention_mask" => attention_mask,
        })?;
        let value = outputs
            .get("image_embeds")
            .ok_or(CrossModalEmbedderError::MissingOutput("image_embeds"))?;
        let (_, data) = value.try_extract_tensor::<f32>()?;

        let vector = normalize_vector(data);
        if vector.is_empty() {
            return Err(CrossModalEmbedderError::EmptyVector);
        }

        Ok(vector)
    }
}

fn dummy_tokens() -> Box<[i64]> {
    let mut ids = vec![49407_i64; 77];
    ids[0] = 49406;
    ids[1] = 49407;
    ids.into_boxed_slice()
}

fn dummy_attention() -> Box<[i64]> {
    let mut mask = vec![0_i64; 77];
    mask[0] = 1;
    mask[1] = 1;
    mask.into_boxed_slice()
}

fn preprocess_clip_image(path: &Path) -> Result<Vec<f32>> {
    if !path.exists() {
        return Err(CrossModalEmbedderError::ImageNotFound(
            path.display().to_string(),
        ));
    }

    let image = load_image_rgb8(path)?;
    let width = image.width();
    let height = image.height();
    if width == 0 || height == 0 {
        return Err(CrossModalEmbedderError::EmptyVector);
    }

    let scale = 224.0 / width.min(height) as f32;
    let resized_width = (width as f32 * scale).round().max(224.0) as u32;
    let resized_height = (height as f32 * scale).round().max(224.0) as u32;
    let resized = image::imageops::resize(
        &image,
        resized_width,
        resized_height,
        image::imageops::FilterType::CatmullRom,
    );
    let left = (resized_width - 224) / 2;
    let top = (resized_height - 224) / 2;
    let cropped = image::imageops::crop_imm(&resized, left, top, 224, 224).to_image();

    let mean = [0.48145466_f32, 0.4578275, 0.40821073];
    let std = [0.26862954_f32, 0.26130258, 0.27577711];
    let mut tensor = vec![0.0_f32; 3 * 224 * 224];

    for y in 0..224_usize {
        for x in 0..224_usize {
            let pixel = cropped.get_pixel(x as u32, y as u32);
            for channel in 0..3_usize {
                let value = pixel[channel] as f32 / 255.0;
                tensor[channel * 224 * 224 + y * 224 + x] = (value - mean[channel]) / std[channel];
            }
        }
    }

    Ok(tensor)
}

fn load_image_rgb8(path: &Path) -> Result<image::RgbImage> {
    if !path.exists() {
        return Err(CrossModalEmbedderError::ImageNotFound(
            path.display().to_string(),
        ));
    }

    let bytes = std::fs::read(path).map_err(CrossModalEmbedderError::ImageIo)?;
    Ok(image::load_from_memory(&bytes)?.to_rgb8())
}

fn normalize_vector(vector: &[f32]) -> Vec<f32> {
    let norm = vector
        .iter()
        .map(|value| {
            let value = *value as f64;
            value * value
        })
        .sum::<f64>()
        .sqrt();

    if norm == 0.0 {
        return vector.to_vec();
    }

    vector
        .iter()
        .map(|value| (*value as f64 / norm) as f32)
        .collect()
}

#[derive(Debug, Clone, Default)]
#[cfg(test)]
pub struct LocalVisualEmbedder;

#[cfg(test)]
impl LocalVisualEmbedder {
    pub const MODEL_VERSION: &'static str = "local-visual-v1:rgb-histogram-6";
}

#[cfg(test)]
impl CrossModalEmbedder for LocalVisualEmbedder {
    fn model_version(&self) -> &str {
        Self::MODEL_VERSION
    }

    fn encode_text(&self, _input: &str) -> Result<Vec<f32>> {
        Err(CrossModalEmbedderError::EmptyTextInput)
    }

    fn encode_image(&self, path: &Path) -> Result<Vec<f32>> {
        let image = load_image_rgb8(path)?;
        let pixel_count = image.width() as f32 * image.height() as f32;
        if pixel_count == 0.0 {
            return Err(CrossModalEmbedderError::EmptyVector);
        }

        let mut sums = [0.0_f32; 3];
        let mut squared_sums = [0.0_f32; 3];
        for pixel in image.pixels() {
            for channel in 0..3 {
                let value = pixel[channel] as f32 / 255.0;
                sums[channel] += value;
                squared_sums[channel] += value * value;
            }
        }

        let mut vector = Vec::with_capacity(6);
        for channel in 0..3 {
            vector.push(sums[channel] / pixel_count);
        }
        for channel in 0..3 {
            let mean = sums[channel] / pixel_count;
            let variance = (squared_sums[channel] / pixel_count) - (mean * mean);
            vector.push(variance.max(0.0).sqrt());
        }

        if vector.iter().all(|value| *value == 0.0) {
            vector[0] = f32::EPSILON;
        }

        Ok(vector)
    }
}

pub fn resolve_clip_model_path(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let path = resource_dir.join("models/clip/clip-vit-b-32-int8.onnx");
        if path.exists() {
            return path;
        }
    }

    for candidate in [
        PathBuf::from("models/clip/clip-vit-b-32-int8.onnx"),
        PathBuf::from("src-tauri/app/models/clip/clip-vit-b-32-int8.onnx"),
        PathBuf::from("src-tauri/models/clip/clip-vit-b-32-int8.onnx"),
    ] {
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from("models/clip/clip-vit-b-32-int8.onnx")
}

struct EncodedText {
    input_ids: Box<[i64]>,
    attention_mask: Box<[i64]>,
}

struct ClipTokenizer {
    vocab: HashMap<String, i64>,
    bpe_ranks: HashMap<(String, String), usize>,
    byte_encoder: HashMap<u8, char>,
    cache: Mutex<HashMap<String, Vec<String>>>,
}

impl ClipTokenizer {
    fn from_dir(dir: &Path) -> Result<Self> {
        let vocab = serde_json::from_str::<HashMap<String, i64>>(&std::fs::read_to_string(
            dir.join("vocab.json"),
        )?)?;
        let merges = std::fs::read_to_string(dir.join("merges.txt"))?;
        let bpe_ranks = merges
            .lines()
            .filter(|line| !line.starts_with('#'))
            .filter_map(|line| {
                let mut parts = line.split_whitespace();
                Some((
                    (parts.next()?.to_string(), parts.next()?.to_string()),
                    0_usize,
                ))
            })
            .enumerate()
            .map(|(rank, (pair, _))| (pair, rank))
            .collect();

        Ok(Self {
            vocab,
            bpe_ranks,
            byte_encoder: bytes_to_unicode(),
            cache: Mutex::new(HashMap::new()),
        })
    }

    fn encode(&self, text: &str) -> Result<EncodedText> {
        let mut ids = vec![49406_i64];
        for token in basic_clip_tokens(text) {
            let encoded = token
                .as_bytes()
                .iter()
                .map(|byte| self.byte_encoder[byte])
                .collect::<String>();

            for part in self.bpe(&encoded) {
                let id = self
                    .vocab
                    .get(&part)
                    .ok_or_else(|| CrossModalEmbedderError::MissingToken(part.clone()))?;
                ids.push(*id);
            }
        }
        ids.push(49407);

        if ids.len() > 77 {
            ids.truncate(77);
            ids[76] = 49407;
        }

        let mut attention_mask = vec![1_i64; ids.len()];
        while ids.len() < 77 {
            ids.push(49407);
            attention_mask.push(0);
        }

        Ok(EncodedText {
            input_ids: ids.into_boxed_slice(),
            attention_mask: attention_mask.into_boxed_slice(),
        })
    }

    fn bpe(&self, token: &str) -> Vec<String> {
        if let Some(cached) = self.cache.lock().unwrap().get(token).cloned() {
            return cached;
        }

        let chars = token.chars().map(|ch| ch.to_string()).collect::<Vec<_>>();
        if chars.is_empty() {
            return vec![];
        }

        let mut word = chars;
        let last = word.len() - 1;
        word[last].push_str("</w>");

        loop {
            let Some((first, second)) = best_pair(&word, &self.bpe_ranks) else {
                break;
            };

            let mut new_word = Vec::with_capacity(word.len());
            let mut index = 0;
            while index < word.len() {
                if index < word.len() - 1 && word[index] == first && word[index + 1] == second {
                    new_word.push(format!("{first}{second}"));
                    index += 2;
                } else {
                    new_word.push(word[index].clone());
                    index += 1;
                }
            }

            word = new_word;
            if word.len() == 1 {
                break;
            }
        }

        self.cache
            .lock()
            .unwrap()
            .insert(token.to_string(), word.clone());
        word
    }
}

fn best_pair(
    word: &[String],
    bpe_ranks: &HashMap<(String, String), usize>,
) -> Option<(String, String)> {
    word.windows(2)
        .filter_map(|pair| {
            let key = (pair[0].clone(), pair[1].clone());
            bpe_ranks.get(&key).map(|rank| (*rank, key))
        })
        .min_by_key(|(rank, _)| *rank)
        .map(|(_, pair)| pair)
}

fn basic_clip_tokens(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in text.to_lowercase().chars() {
        if ch.is_alphanumeric() {
            current.push(ch);
        } else {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            if !ch.is_whitespace() {
                tokens.push(ch.to_string());
            }
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn bytes_to_unicode() -> HashMap<u8, char> {
    let mut bs = (b'!'..=b'~').collect::<Vec<_>>();
    bs.extend(0xA1_u8..=0xAC_u8);
    bs.extend(0xAE_u8..=0xFF_u8);

    let mut cs = bs.iter().map(|byte| *byte as u32).collect::<Vec<_>>();
    let mut seen = bs.iter().copied().collect::<HashSet<_>>();
    let mut n = 0_u32;
    for byte in 0_u8..=255_u8 {
        if !seen.contains(&byte) {
            bs.push(byte);
            cs.push(256 + n);
            seen.insert(byte);
            n += 1;
        }
    }

    bs.into_iter()
        .zip(
            cs.into_iter()
                .map(|codepoint| char::from_u32(codepoint).expect("valid CLIP byte codepoint")),
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;
    use std::path::Path;

    use image::{DynamicImage, ImageBuffer, ImageFormat, Rgb};

    use super::{ClipOnnxEmbedder, CrossModalEmbedder, LocalVisualEmbedder};

    #[test]
    fn local_visual_embedder_encodes_image_to_stable_nonzero_vector() {
        let path = std::env::temp_dir().join(format!(
            "snaplex-visual-embedder-{}.png",
            uuid::Uuid::new_v4()
        ));
        let image = ImageBuffer::from_fn(2, 1, |x, _| {
            if x == 0 {
                Rgb([255_u8, 0, 0])
            } else {
                Rgb([0_u8, 0, 255])
            }
        });
        image.save(&path).unwrap();

        let embedder = LocalVisualEmbedder::default();
        let vector = embedder.encode_image(&path).unwrap();
        let repeated = embedder.encode_image(&path).unwrap();

        let _ = std::fs::remove_file(&path);

        assert_eq!(embedder.model_version(), "local-visual-v1:rgb-histogram-6");
        assert_eq!(vector, repeated);
        assert_eq!(vector.len(), 6);
        assert!(vector.iter().any(|value| *value > 0.0));
    }

    #[test]
    fn local_visual_embedder_reports_missing_images() {
        let embedder = LocalVisualEmbedder::default();
        let err = embedder
            .encode_image(Path::new("/tmp/snaplex-missing-image.png"))
            .unwrap_err();

        assert!(err.to_string().contains("does not exist"));
    }

    #[test]
    fn local_visual_embedder_decodes_by_content_not_extension() {
        let path = std::env::temp_dir().join(format!(
            "snaplex-misnamed-jpeg-{}.png",
            uuid::Uuid::new_v4()
        ));
        let image = DynamicImage::ImageRgb8(ImageBuffer::from_pixel(4, 4, Rgb([255, 0, 0])));
        let mut cursor = Cursor::new(Vec::new());
        image.write_to(&mut cursor, ImageFormat::Jpeg).unwrap();
        std::fs::write(&path, cursor.into_inner()).unwrap();

        let embedder = LocalVisualEmbedder::default();
        let vector = embedder.encode_image(&path).unwrap();

        let _ = std::fs::remove_file(&path);

        assert_eq!(vector.len(), 6);
        assert!(vector.iter().any(|value| *value > 0.0));
    }

    #[test]
    fn clip_onnx_embedder_encodes_image_to_512d_vector() {
        let model_path = Path::new("models/clip/clip-vit-b-32-int8.onnx");
        if !model_path.exists() {
            eprintln!("skipping CLIP ONNX test; model asset is not present");
            return;
        }

        let path = std::env::temp_dir().join(format!(
            "snaplex-clip-embedder-{}.png",
            uuid::Uuid::new_v4()
        ));
        let image = ImageBuffer::from_fn(32, 32, |x, y| {
            if x > y {
                Rgb([240_u8, 40, 40])
            } else {
                Rgb([20_u8, 40, 220])
            }
        });
        image.save(&path).unwrap();

        let embedder = ClipOnnxEmbedder::from_model_file(model_path).unwrap();
        let vector = embedder.encode_image(&path).unwrap();

        let _ = std::fs::remove_file(&path);

        assert_eq!(vector.len(), 512);
        assert!(vector.iter().all(|value| value.is_finite()));
        let norm = vector
            .iter()
            .map(|value| (*value as f64) * (*value as f64))
            .sum::<f64>()
            .sqrt();
        assert!((norm - 1.0).abs() < 1e-4);
    }

    #[test]
    fn clip_onnx_embedder_encodes_text_to_512d_vector() {
        let model_path = Path::new("models/clip/clip-vit-b-32-int8.onnx");
        if !model_path.exists() {
            eprintln!("skipping CLIP ONNX test; model asset is not present");
            return;
        }

        let embedder = ClipOnnxEmbedder::from_model_file(model_path).unwrap();
        let vector = embedder.encode_text("red neon night").unwrap();

        assert_eq!(vector.len(), 512);
        assert!(vector.iter().all(|value| value.is_finite()));
        let norm = vector
            .iter()
            .map(|value| (*value as f64) * (*value as f64))
            .sum::<f64>()
            .sqrt();
        assert!((norm - 1.0).abs() < 1e-4);
    }
}
