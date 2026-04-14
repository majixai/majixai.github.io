# `/tensor/neural` — Neural-Network Tensor Primitives (JavaScript ES Modules)

This sub-directory contains the **canonical** JavaScript implementations of the
tensor math primitives and neural-network layer architecture used across the
repo.

## Files

| File | Exports | Description |
|------|---------|-------------|
| `tensor.js` | `Tensor`, `AdamOptimizer` | Lightweight typed-array tensor class with activations, matmul, MSE loss, and Adam gradient-descent optimizer |
| `network.js` | `DenseLayer`, `MarketSignalNetwork` | Feed-forward neural network for market signal prediction |

## Usage

```js
// Tensor primitives
import { Tensor, AdamOptimizer } from '/tensor/neural/tensor.js';

const t = Tensor.randn([4, 4], 0.1);
const opt = new AdamOptimizer({ lr: 0.001 });

// Full network
import { MarketSignalNetwork } from '/tensor/neural/network.js';

const net = new MarketSignalNetwork(12, 32, 6);
const { loss, output } = net.train(featureVector, targetVector);
```

## Consumer

`neural_tensor_network/` re-exports these modules via thin shim files, keeping
its own relative-import graph intact while the logic lives here centrally.
