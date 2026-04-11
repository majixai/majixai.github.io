# `/tensor` — Central Tensor Calculation Library

This directory is the **canonical home for all tensor computations** in the MajixAI repository. Every other directory that needs tensor math imports from here rather than defining its own implementation.

## Sub-directories

| Directory | Language | Purpose |
|-----------|----------|---------|
| [`financial/`](financial/) | Python | Market / financial tensor pipeline: feature engineering, HOSVD, Kalman filter, Haar wavelet, regime classification, Monte Carlo forecast, VaR, statistical analysis |
| [`neural/`](neural/) | JavaScript (ES module) | Neural-network tensor primitives: `Tensor` class, `AdamOptimizer`, `DenseLayer`, `MarketSignalNetwork` |
| [`vision/`](vision/) | JavaScript (global script) | Visual similarity engine: `TensorSimilarityEngine` using TensorFlow.js + MobileNet |

## Usage

### Python — financial tensor math

```python
# Add repo root to path once (already done in tensor_engine.py)
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from tensor.financial import (
    build_feature_matrix,
    tensor_decompose,
    kalman_filter,
    haar_decompose,
    tensor_contract,
    monte_carlo_forecast,
    cross_asset_summary,
    compute_var,
    rolling_tensor_signal,
)
from tensor.financial.config import LOOKBACK, FEATURES, REGIMES, REGIME_LABELS
```

### JavaScript — neural network (ES module)

```js
import { Tensor, AdamOptimizer } from '/tensor/neural/tensor.js';
import { DenseLayer, MarketSignalNetwork } from '/tensor/neural/network.js';
```

### JavaScript — visual similarity (global script tag)

```html
<script src="/tensor/vision/tensor-similarity.js"></script>
<!-- TensorSimilarityEngine is now available in global scope -->
<script>
  const engine = new TensorSimilarityEngine();
</script>
```

## Consumer directories

| Directory | Tensor sub-package used |
|-----------|------------------------|
| `tradingview_integration/` | `tensor.financial` |
| `neural_tensor_network/` | `tensor.neural` |
| `best/beta/` | `tensor.vision` |
| `best/gamma/` | `tensor.vision` |
