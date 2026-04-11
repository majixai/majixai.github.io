# `/tensor/vision` — Visual Similarity Engine (JavaScript)

This sub-directory contains the **canonical** `TensorSimilarityEngine` — a
GPU-accelerated visual similarity engine that uses TensorFlow.js + MobileNet v2
to compare performer images via cosine similarity of their embedding vectors.

## Files

| File | Description |
|------|-------------|
| `tensor-similarity.js` | `TensorSimilarityEngine` class — lazy-loads MobileNet, computes 1024-dim embeddings, ranks performers by cosine similarity |

## Usage

Include the TF.js and MobileNet CDN scripts **before** loading this file:

```html
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1"></script>
<script src="/tensor/vision/tensor-similarity.js"></script>
```

Then in your page script:

```js
const engine = new TensorSimilarityEngine();

// On performer click:
engine.analyzeClick(clickedUser, allUsers, (similarUsername, weight) => {
  awardPoints(similarUsername, weight);
});
```

## Consumers

| Directory | Notes |
|-----------|-------|
| `best/beta/` | Loads via `<script src="/tensor/vision/tensor-similarity.js">` |
| `best/gamma/` | Loads via `<script src="/tensor/vision/tensor-similarity.js">` |
