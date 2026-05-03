# PRD — 完整实现 Snaplex 搜索功能

**Status:** Proposed
**Owner:** TBD
**Last updated:** 2026-05-03
**Related:** `docs/DEVELOPMENT_PLAN.md` (原始混合搜索设计), `docs/PHASE_0_1_2_PROGRESS.md`

## Problem Statement

Snaplex 是一款本地优先的图片资产管理桌面应用。当前用户在搜索框输入查询时:

- **关键词搜索可用**:能命中分析文本中字面包含查询词的图片 (FTS5)。
- **语义搜索完全不可用**:用户搜"黄昏的海"无法命中标注为"夕阳的港湾"的图片,即使两者语义高度相关。
- **视觉搜索完全不可用**:用户搜"红色"无法命中尚未做过 AI 分析、但视觉上确实以红色为主的图片。
- **跨模态搜索完全不可用**:用户无法用文字找出"看起来像粉色霓虹夜景"的图片。

设计稿规划的"FTS + Text Embedding + CLIP 视觉搜索"三路融合搜索,只有第一路真正联通。前端 fusion 算法、UI、Tauri IPC 接口已经齐全,但 Rust 后端的两路 embedding 命令是空桩 (`Phase 0: stub`),`embeddings` 与 `visual_embeddings` 表 schema 存在却从未被写入。结果是用户得到一个**外观完整、能力残缺**的搜索栏 — 这种"看似工作"的状态比明显坏掉更具误导性。

## Solution

把三路搜索打通到 production-ready 状态:

1. **Text Embedding 路径**:在分析保存时,通过用户配置的 Embedding API (OpenAI / 兼容供应商) 将分析文本编码成向量并入库;搜索时把查询文本同样编码,做近邻检索。
2. **CLIP 视觉搜索路径**:在图片导入时,用打包在 App 内的本地 CLIP ViT-B-32 INT8 模型推理出视觉向量并入库;搜索时把查询文本经 CLIP 文本塔编码到共享多模态空间,与视觉向量做近邻检索。
3. **Backfill 工具**:为已导入但缺向量的旧图库一次性补算,带进度反馈与断点续做。
4. **设置面板**:暴露 Embedding API key / endpoint / 模型选择,以及 CLIP 索引开关与构建状态。

完成后,前端已有的三路融合排序 (FTS 0.40 + Embedding 0.35 + CLIP 0.25 + 跨源 1.15× boost) 才会真正起作用。

## User Stories

1. As a 摄影师 collecting reference imagery, I want to find images by visual similarity to a text description, so that I can locate references even when I never wrote down what's in them.
2. As a designer with a 5,000-image moodboard, I want semantic search to find conceptually similar shots beyond exact keywords, so that I don't miss good candidates due to wording differences.
3. As a Chinese-speaking user, I want to search in Chinese and find images whose analysis was written in English (or vice versa), so that the language of past annotations doesn't gate discoverability.
4. As a power user, I want my search results to combine keyword, semantic, and visual signals automatically, so that I see one ranked list rather than juggle three modes.
5. As a privacy-conscious user, I want CLIP visual indexing to run entirely locally with no network calls, so that my image content never leaves my machine.
6. As a cost-sensitive user, I want text embedding to be opt-in and use my own API key, so that I control exactly what is sent and what I pay for.
7. As a user with an existing library, I want a backfill operation that indexes my pre-existing images without me having to re-import them, so that the new search works on day one.
8. As a user running backfill on 50,000 images, I want clear progress feedback (count, ETA, current file) and the ability to pause/resume, so that I can stop work and continue later without losing progress.
9. As a user importing 500 new images, I want visual indexing to happen in the background without blocking the UI, so that I can keep browsing.
10. As a user, I want freshly imported images to become searchable as soon as their indexing completes, with no app restart, so that the experience feels live.
11. As a user, I want a clear indicator (in settings or the status bar) showing how many images are indexed for visual search vs how many remain, so that I know the search is comprehensive.
12. As a user without an Embedding API configured, I want the app to silently fall back to FTS + CLIP only and not error, so that the app stays usable when one signal is unavailable.
13. As a user whose embedding API call fails (rate limit, network), I want that failure to be retried with backoff and not block image import or search, so that transient outages don't corrupt my workflow.
14. As a user, I want to see which signal contributed to a result (FTS / semantic / visual icon on the thumbnail), so that I can understand why something matched.
15. As a user changing my embedding provider or model, I want a way to clear and rebuild the text-embedding index, so that I'm not stuck with vectors from an outdated model.
16. As a user, I want CLIP and embedding indexing to skip already-indexed images on subsequent runs, so that backfill is idempotent and cheap.
17. As a user deleting an image, I want its associated vectors removed too, so that the search index doesn't drift from the canonical image set.
18. As a user moving an image between folders, I want its vectors to remain valid (not re-computed), so that folder reorganization doesn't trigger expensive re-indexing.
19. As a developer extending Snaplex with a new embedding provider, I want a clean trait boundary to implement against, so that I don't have to touch unrelated search code.
20. As a developer swapping the CLIP model (e.g. ViT-B/32 → ViT-L/14), I want the change confined to the cross-modal embedder implementation, so that vector-store, indexer, and search service remain untouched.
21. As a developer running tests, I want the search service tests to use mocked embedders and a real in-memory SQLite, so that tests are fast and verify real SQL behavior.
22. As an operator inspecting a library, I want the index health (counts per signal, last failure, model versions in use) visible in a diagnostics view, so that I can debug "why didn't X show up".
23. As a user on first launch with bundled CLIP model, I want the model to load lazily on first search/import rather than at app startup, so that cold start stays fast.
24. As a user, I want search latency to stay under ~300 ms p95 for libraries up to 10,000 images, so that the search bar feels live (matches existing 300ms debounce contract).
25. As a user with a slow embedding API, I want the FTS + CLIP results to render immediately and the embedding column to fill in when it arrives, so that I'm not blocked on the slowest source.

## Implementation Decisions

### Architecture

- **Two distinct embedder traits** (Option B):
  - `TextEmbedder` — single method `encode(&str) -> Result<Vec<f32>>`. Implementations call out to a configured HTTP API (OpenAI-compatible). One vector space, used to encode analysis text at write time and queries at search time. Targets the `embeddings` table.
  - `CrossModalEmbedder` — two methods `encode_text(&str)` and `encode_image(&Path)`. Implementation runs a local CLIP ViT-B/32 INT8 ONNX model for both modalities. Single shared multi-modal space. Targets the `visual_embeddings` table.
  - Rationale: the two trait surfaces produce vectors in **incompatible spaces** with different lifecycles, failure modes, and configuration. Encoding the type-level distinction prevents the entire class of "wrong vector in wrong table" bugs and keeps each abstraction shallow on interface, deep on implementation.
- **`vector_store` deep module** — single SQLite-backed module with two tiny operations: `insert(image_id, kind, vector, model_version)` and `nearest(kind, query_vector, k) -> Vec<(image_id, score)>`. Internally encapsulates dimension validation, blob serialization, cosine similarity, and (initially brute-force) top-k. The `kind` parameter routes to `embeddings` or `visual_embeddings`. Storage layout and similarity algorithm can change without touching callers.
- **`indexer`** — thin orchestrator. Subscribes to two domain events: `ImageImported` (→ call `CrossModalEmbedder::encode_image` → `vector_store.insert(visual)`) and `AnalysisSaved` (→ call `TextEmbedder::encode` over a normalized concatenation of analysis fields → `vector_store.insert(text)`). Skips images whose vectors already exist for the current model version (idempotent).
- **`search_service`** — top-level orchestrator that replaces the existing stub commands. Receives a query string + optional folder filter, runs in parallel: FTS via existing `search_fts`, semantic via `TextEmbedder::encode` + `vector_store.nearest(text)`, visual via `CrossModalEmbedder::encode_text` + `vector_store.nearest(visual)`. Returns three result lists with `matchType` discriminators; the existing frontend `fuseSearchResults` does the fusion.
- **`backfill`** — separate command + background task. Iterates images missing vectors of either kind, processes them in batches with bounded parallelism, emits progress events on a Tauri channel, persists a checkpoint per batch so a kill/restart resumes cleanly.
- **Resilience**: any embedder failure during search degrades that source to an empty result list — search never errors out as long as one source returns. Indexing failures are retried with exponential backoff and surfaced in the diagnostics view; they never block image import or analysis save.

### Schema changes

- Add `model_version TEXT NOT NULL` and `dimension INTEGER NOT NULL` columns to `embeddings` and `visual_embeddings` (already partly present — confirm and tighten). Index on `model_version` to support "rebuild on model change".
- Add `embedding_failures` table: `(image_id, kind, last_error, retry_count, last_attempt_at)` for diagnostics and retry scheduling.
- A `library_meta` row tracks the active text-embedding model + CLIP model version, so a mismatch on launch can prompt rebuild rather than silently mixing spaces.

### IPC contracts

- `search_images(query, folder_id)` — unchanged signature, now returns FTS results from real index (already does).
- `visual_search(query, limit)` — unchanged signature, now returns CLIP results instead of `[]`.
- `save_text_embedding` — **removed from public IPC** (the original frontend-driven design is wrong; embeddings are computed inside Rust, never sent across the boundary). Kept temporarily as a deprecated no-op only if existing frontend code still calls it; remove after frontend cleanup.
- New: `start_backfill()` returning a channel id; `cancel_backfill()`; event stream `backfill-progress { processed, total, current_kind, last_error? }`.
- New: `get_index_health()` returning per-kind counts (indexed / total / failed) and active model versions.

### Configuration

- New settings panel section "搜索与索引":
  - Text Embedding provider (OpenAI compatible URL + key + model name); empty = disabled, FTS + CLIP only.
  - CLIP indexing toggle (default on); model file shipped with app, no download UX needed for v1.
  - Buttons: "立即开始 backfill", "重建文本向量索引" (when model changes).

### Frontend

- `SearchBar` and `fuseSearchResults` need no logic changes — already produce/consume three sources.
- New `IndexHealth` component in settings showing per-signal counts and a backfill progress bar listening to the new event stream.
- Optional v1.x: small badge (FTS/语义/视觉) on grid thumbnails when filtering search results, surfacing which source contributed the top score.

### Sequencing

The work splits into vertically sliceable chunks that can be merged independently:

1. **`vector_store` + schema migrations** — pure persistence module. Lands behind a feature flag, no behavior change.
2. **`TextEmbedder` trait + OpenAI-compatible implementation + indexer wiring on `AnalysisSaved`** — turns on semantic indexing. `search_service` still ignores it.
3. **`search_service` real implementation + frontend cleanup of `saveTextEmbedding` IPC** — first user-visible improvement: semantic results in the fusion.
4. **`CrossModalEmbedder` trait + ONNX CLIP implementation + indexer wiring on `ImageImported`** — turns on visual indexing.
5. **`visual_search` real implementation** — second user-visible improvement: CLIP results in the fusion.
6. **`backfill` + progress UI + diagnostics panel** — closes the gap for existing libraries and gives operators a window into index state.
7. **Polish**: model-version change rebuild, retry/backoff hardening, contributor-source badges.

## Testing Decisions

### What makes a good test here

- **Verifies behavior through the public IPC and trait surfaces, not internals.** Tests don't reach into SQL, blob layouts, or ONNX session state. They assert "after importing an image, a query for its visual content returns it within top-k", not "the cosine routine multiplies these specific floats".
- **Survives a model swap or storage refactor.** Switching CLIP B/32 → L/14 or moving from blob-cosine to sqlite-vec must not require any test rewrites — only fixture vectors regenerate.
- **Real SQLite, mocked embedders.** SQL is the one collaborator we don't mock — its semantics are exactly what we want to verify. Embedders are mocked with deterministic vectors so tests are fast, hermetic, and don't depend on network or model files.

### Modules under test (priority order)

1. **`vector_store`** *(highest priority — pure algorithm, easiest to make watertight)*
   - In-memory SQLite + real schema. Covers: insert + retrieve roundtrip, dimension validation rejects mismatched vectors, `nearest` returns top-k in descending similarity, `nearest` excludes vectors of the wrong kind, deletion of an image removes its vectors, idempotent re-insert overwrites with new model version.

2. **`search_service`** *(integration — the orchestration is where bugs hide)*
   - In-memory SQLite + real `vector_store` + mocked `TextEmbedder` and `CrossModalEmbedder` returning fixture vectors. Covers: query returns three labeled result lists, missing/failing embedder degrades that source to `[]` without erroring the call, folder filter scopes FTS results, cancellation/timeout per source doesn't poison sibling sources.

3. **`TextEmbedder` / `CrossModalEmbedder` implementations** *(boundary — protect against API/model regressions)*
   - HTTP layer mocked at the transport level for the API embedder; covers retry/backoff, error mapping, key absence. ONNX layer for CLIP tested with bundled fixture image inputs producing known-stable embeddings (snapshot test on cosine to a reference vector, tolerance-based to survive minor numerical drift).

4. **`backfill`** *(operational path)*
   - Verifies progress events are emitted with monotonic `processed` counts, cancellation halts within one batch, restart skips already-indexed images, a single failing image doesn't abort the whole run.

`indexer` is intentionally not given its own test suite — it's a thin pub/sub adapter and is exercised end-to-end by the `search_service` integration tests.

### Frontend tests

- Existing `fuseSearchResults` and `SearchBar` tests stay as-is.
- New: `IndexHealth` component test driving the progress event stream and asserting the rendered counts/states.

### Prior art

- `src/__tests__/app-lifecycle.test.tsx` and `src/__tests__/image-import.test.tsx` show the integration-style pattern (real component, mocked Tauri IPC at the boundary). New `search_service` integration tests on the Rust side mirror that philosophy: real internals, mocks only at process/network/model boundaries.
- Existing `src/components/search/fuseSearchResults.test.ts` and `SearchBar.test.tsx` (added in this branch) demonstrate the unit-pure + behavior-focused style that should propagate to Rust tests.

## Out of Scope

- **Approximate nearest-neighbor (HNSW, IVF, sqlite-vec)** — start with brute-force cosine. Acceptable up to ~50k images at expected query latency. Switching to ANN later requires only `vector_store` internal change, not interface change. Out of scope for v1.
- **Multiple text-embedding providers in one library simultaneously** — the active provider/model is a library-wide setting. Switching providers triggers a rebuild prompt. Mixed-provider indexes are out of scope.
- **CLIP model auto-download / on-demand model swap** — v1 ships one bundled model. Swappable model UX is future work.
- **Per-image manual embedding (e.g. "find similar to this image")** — the architecture supports it (CLIP image→image cosine), but the UI flow is out of scope here. Tracked as a follow-on.
- **Tag/face/OCR signals** — not part of the original three-source design; revisit as a separate PRD if pursued.
- **Offline / queue-based embedding API mode** — v1 calls API synchronously per analysis save with retry. Bulk async batching is a later optimization.
- **Cross-library search** — Snaplex is single-library; not changing that here.

## Further Notes

- **Why two embedder traits and not one** is the single most important design call here. See the conversation that led to this PRD: a single `EmbeddingProvider` interface obscures that CLIP-text and API-text vectors live in non-interchangeable spaces, encourages "stuff a wrong vector in" bugs, and forces the union of two unrelated failure modes into one Result. Two traits cost ~3 lines of orchestrator glue and pay back in type-level safety + independent evolution.
- **Vector dimension drift** is the most likely production footgun. Mitigation: every insert validates dimension matches the active model's declared dimension; every read verifies stored `model_version` matches active; mismatch triggers a clear "rebuild required" prompt rather than silent garbage results.
- **Test data for CLIP**: use 3–5 small bundled fixture images plus their pre-computed reference embeddings checked into the test corpus. Tolerance-based assertion (cosine ≥ 0.99 to reference) survives minor ONNX runtime version drift without becoming a moving target.
- **Performance target** of 300 ms p95 search latency at 10k images is achievable with brute-force cosine on 512d vectors (~5 MB total, all in memory); revisit when libraries cross 50k.
- **No issue tracker connected** to this repo — this PRD lives as a doc rather than a tracker entry. When work starts, breaking it into the 7 sequenced chunks above is a natural fit for `/to-issues`.
