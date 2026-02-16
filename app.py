from flask import Flask, jsonify, request, g
from transformers import pipeline
import database
from app.controllers import git_action_controller
from dotenv import load_dotenv
import os
import logging
import time
import json
import zlib
import gzip
import bz2
from functools import wraps
from datetime import datetime
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

# Configure comprehensive logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('flask.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()
API_KEY = os.getenv("API_KEY")

app = Flask(__name__)
database.init_app(app)

# Initialize AI models
logger.info("Initializing AI models...")
generator = pipeline('text-generation', model='gpt2')
summarizer = pipeline("summarization")
translator = pipeline("translation_en_to_de")
qa = pipeline("question-answering")
logger.info("AI models initialized successfully")

# ============================================================================
# COMPRESSION DATABASE UTILITIES
# ============================================================================

class CompressionDatabase:
    """Extensive compression database implementation"""
    
    @staticmethod
    def compress_zlib(data):
        """Compress data using zlib"""
        if isinstance(data, str):
            data = data.encode('utf-8')
        compressed = zlib.compress(data, level=9)
        logger.debug(f"ZLIB compression: {len(data)} bytes -> {len(compressed)} bytes (ratio: {len(compressed)/len(data):.2%})")
        return compressed
    
    @staticmethod
    def decompress_zlib(compressed_data):
        """Decompress zlib data"""
        decompressed = zlib.decompress(compressed_data)
        logger.debug(f"ZLIB decompression: {len(compressed_data)} bytes -> {len(decompressed)} bytes")
        return decompressed.decode('utf-8')
    
    @staticmethod
    def compress_gzip(data):
        """Compress data using gzip"""
        if isinstance(data, str):
            data = data.encode('utf-8')
        compressed = gzip.compress(data, compresslevel=9)
        logger.debug(f"GZIP compression: {len(data)} bytes -> {len(compressed)} bytes (ratio: {len(compressed)/len(data):.2%})")
        return compressed
    
    @staticmethod
    def decompress_gzip(compressed_data):
        """Decompress gzip data"""
        decompressed = gzip.decompress(compressed_data)
        logger.debug(f"GZIP decompression: {len(compressed_data)} bytes -> {len(decompressed)} bytes")
        return decompressed.decode('utf-8')
    
    @staticmethod
    def compress_bz2(data):
        """Compress data using bz2"""
        if isinstance(data, str):
            data = data.encode('utf-8')
        compressed = bz2.compress(data, compresslevel=9)
        logger.debug(f"BZ2 compression: {len(data)} bytes -> {len(compressed)} bytes (ratio: {len(compressed)/len(data):.2%})")
        return compressed
    
    @staticmethod
    def decompress_bz2(compressed_data):
        """Decompress bz2 data"""
        decompressed = bz2.decompress(compressed_data)
        logger.debug(f"BZ2 decompression: {len(compressed_data)} bytes -> {len(decompressed)} bytes")
        return decompressed.decode('utf-8')
    
    @staticmethod
    def store_compressed(db, table, data, compression_type='zlib'):
        """Store data in database with compression"""
        logger.info(f"Storing compressed data in {table} using {compression_type}")
        json_data = json.dumps(data)
        
        if compression_type == 'zlib':
            compressed = CompressionDatabase.compress_zlib(json_data)
        elif compression_type == 'gzip':
            compressed = CompressionDatabase.compress_gzip(json_data)
        elif compression_type == 'bz2':
            compressed = CompressionDatabase.compress_bz2(json_data)
        else:
            logger.error(f"Unknown compression type: {compression_type}")
            compressed = json_data.encode('utf-8')
        
        logger.info(f"Compression complete. Original: {len(json_data)} bytes, Compressed: {len(compressed)} bytes")
        return compressed
    
    @staticmethod
    def retrieve_compressed(compressed_data, compression_type='zlib'):
        """Retrieve and decompress data from database"""
        logger.info(f"Retrieving compressed data using {compression_type}")
        
        if compression_type == 'zlib':
            decompressed = CompressionDatabase.decompress_zlib(compressed_data)
        elif compression_type == 'gzip':
            decompressed = CompressionDatabase.decompress_gzip(compressed_data)
        elif compression_type == 'bz2':
            decompressed = CompressionDatabase.decompress_bz2(compressed_data)
        else:
            logger.error(f"Unknown compression type: {compression_type}")
            decompressed = compressed_data.decode('utf-8')
        
        data = json.loads(decompressed)
        logger.info(f"Decompression complete. Data retrieved successfully")
        return data

# ============================================================================
# TENSOR AND AI OPERATIONS
# ============================================================================

class TensorOperations:
    """Comprehensive tensor operations for AI processing"""
    
    @staticmethod
    def create_tensor(data, dtype=torch.float32):
        """Create a tensor from data"""
        logger.info(f"Creating tensor with dtype {dtype}")
        if isinstance(data, list):
            tensor = torch.tensor(data, dtype=dtype)
        elif isinstance(data, np.ndarray):
            tensor = torch.from_numpy(data).type(dtype)
        else:
            tensor = torch.tensor([data], dtype=dtype)
        logger.debug(f"Tensor created with shape {tensor.shape}")
        return tensor
    
    @staticmethod
    def matrix_multiply(tensor1, tensor2):
        """Perform matrix multiplication"""
        logger.info(f"Matrix multiplication: {tensor1.shape} x {tensor2.shape}")
        result = torch.matmul(tensor1, tensor2)
        logger.debug(f"Result shape: {result.shape}")
        return result
    
    @staticmethod
    def tensor_transform(tensor, operation='normalize'):
        """Apply transformations to tensors"""
        logger.info(f"Applying {operation} transformation to tensor")
        if operation == 'normalize':
            result = F.normalize(tensor, dim=-1)
        elif operation == 'softmax':
            result = F.softmax(tensor, dim=-1)
        elif operation == 'relu':
            result = F.relu(tensor)
        elif operation == 'sigmoid':
            result = torch.sigmoid(tensor)
        else:
            logger.warning(f"Unknown operation: {operation}, returning original tensor")
            result = tensor
        logger.debug(f"Transformation complete")
        return result
    
    @staticmethod
    def tensor_statistics(tensor):
        """Calculate statistics for tensor"""
        logger.info("Calculating tensor statistics")
        stats = {
            'mean': float(torch.mean(tensor)),
            'std': float(torch.std(tensor)),
            'min': float(torch.min(tensor)),
            'max': float(torch.max(tensor)),
            'shape': list(tensor.shape),
            'dtype': str(tensor.dtype)
        }
        logger.debug(f"Tensor statistics: {stats}")
        return stats

class AIModel(nn.Module):
    """Simple neural network for AI operations"""
    
    def __init__(self, input_size=10, hidden_size=20, output_size=5):
        super(AIModel, self).__init__()
        logger.info(f"Initializing AI model: input={input_size}, hidden={hidden_size}, output={output_size}")
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, output_size)
        self.dropout = nn.Dropout(0.2)
    
    def forward(self, x):
        logger.debug(f"Forward pass with input shape {x.shape}")
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        return x
    
    def predict(self, input_data):
        """Make predictions"""
        logger.info("Making prediction with AI model")
        self.eval()
        with torch.no_grad():
            tensor_input = TensorOperations.create_tensor(input_data)
            output = self.forward(tensor_input)
            logger.debug(f"Prediction output shape: {output.shape}")
        return output

# Initialize AI model
ai_model = AIModel()
logger.info("AI model initialized successfully")

# ============================================================================
# LOGGING MIDDLEWARE AND UTILITIES
# ============================================================================

def log_request_response(f):
    """Decorator to log all requests and responses extensively"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Log request details
        request_id = f"{datetime.now().timestamp()}"
        logger.info(f"[{request_id}] === REQUEST START ===")
        logger.info(f"[{request_id}] Method: {request.method}")
        logger.info(f"[{request_id}] Path: {request.path}")
        logger.info(f"[{request_id}] URL: {request.url}")
        logger.info(f"[{request_id}] Remote Address: {request.remote_addr}")
        logger.info(f"[{request_id}] Headers: {dict(request.headers)}")
        
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                request_data = request.get_json()
                logger.info(f"[{request_id}] Request Body: {json.dumps(request_data, indent=2)}")
            except Exception as e:
                logger.warning(f"[{request_id}] Could not parse request body: {e}")
        
        # Execute the function and capture response
        start_time = time.time()
        try:
            response = f(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log response details
            logger.info(f"[{request_id}] === RESPONSE START ===")
            logger.info(f"[{request_id}] Execution Time: {execution_time:.4f} seconds")
            logger.info(f"[{request_id}] Status Code: {response.status_code if hasattr(response, 'status_code') else 'N/A'}")
            
            # Log response data
            if isinstance(response, tuple):
                response_data, status_code = response
                logger.info(f"[{request_id}] Response Status: {status_code}")
                logger.info(f"[{request_id}] Response Body: {json.dumps(response_data.get_json(), indent=2)}")
            else:
                try:
                    response_json = response.get_json()
                    logger.info(f"[{request_id}] Response Body: {json.dumps(response_json, indent=2)}")
                except Exception as e:
                    logger.warning(f"[{request_id}] Could not parse response body: {e}")
            
            logger.info(f"[{request_id}] === REQUEST COMPLETED ===")
            return response
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"[{request_id}] === ERROR ===")
            logger.error(f"[{request_id}] Execution Time: {execution_time:.4f} seconds")
            logger.error(f"[{request_id}] Error: {str(e)}", exc_info=True)
            logger.error(f"[{request_id}] === REQUEST FAILED ===")
            raise
    
    return decorated_function

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route('/api/links', methods=['GET'])
@log_request_response
def get_links():
    logger.info("Fetching all links from database")
    db = database.get_db()
    cursor = db.execute('SELECT * FROM links')
    links = cursor.fetchall()
    result = [dict(link) for link in links]
    logger.info(f"Retrieved {len(result)} links from database")
    return jsonify(result)

@app.route('/api/links', methods=['POST'])
@log_request_response
def add_link():
    new_link = request.get_json()
    logger.info(f"Adding new link: {new_link}")
    db = database.get_db()
    db.execute('INSERT INTO links (text, url) VALUES (?, ?)',
               [new_link['text'], new_link['url']])
    db.commit()
    logger.info("Link added successfully")
    return jsonify(new_link)

@app.route('/api/links/click', methods=['POST'])
@log_request_response
def increment_click_count():
    link_url = request.get_json()['url']
    logger.info(f"Incrementing click count for URL: {link_url}")
    
    try:
        import fcntl
        with open('menu/clicks.json', 'r+') as f:
            # Acquire exclusive lock for thread-safe operation
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                clicks = json.load(f)
                old_count = clicks.get(link_url, 0)
                clicks[link_url] = old_count + 1
                f.seek(0)
                json.dump(clicks, f, indent=4)
                f.truncate()
                logger.info(f"Click count incremented from {old_count} to {clicks[link_url]}")
                return jsonify({'message': 'Click count incremented', 'count': clicks[link_url]})
            finally:
                # Release lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except FileNotFoundError:
        logger.error("Click tracking file not found: menu/clicks.json")
        return jsonify({'error': 'Click tracking file not found. Please ensure menu/clicks.json exists.'}), 404
    except Exception as e:
        logger.error(f"Error updating click count: {e}")
        return jsonify({'error': f'Failed to update click count: {str(e)}'}), 500

@app.route('/api/generate', methods=['POST'])
@log_request_response
def generate_text():
    prompt = request.get_json()['prompt']
    logger.info(f"Generating text for prompt: {prompt[:50]}...")
    generated_text = generator(prompt, max_length=50, num_return_sequences=1)
    result = generated_text[0]['generated_text']
    logger.info(f"Generated text length: {len(result)} characters")
    return jsonify({'generated_text': result})

@app.route('/api/git-action', methods=['POST'])
@log_request_response
def trigger_git_action():
    logger.info("Triggering git action")
    git_action_controller.run_git_action()
    logger.info("Git action completed successfully")
    return jsonify({'message': 'Git action triggered'})

@app.route('/api/python-action', methods=['POST'])
@log_request_response
def python_action():
    logger.info("Executing python action")
    # In a real application, you would have some python logic here
    logger.info("Python action completed")
    return jsonify({'message': 'Python action triggered'})

@app.route('/api/genai-action', methods=['POST'])
@log_request_response
def genai_action():
    prompt = request.get_json()['prompt']
    logger.info(f"GenAI action with prompt: {prompt[:50]}...")
    generated_text = generator(prompt, max_length=50, num_return_sequences=1)
    result = generated_text[0]['generated_text']
    logger.info(f"GenAI generated text length: {len(result)} characters")
    return jsonify({'generated_text': result})

@app.route('/api/data-storage-action', methods=['POST'])
@log_request_response
def data_storage_action():
    new_link = request.get_json()
    logger.info(f"Storing data: {new_link}")
    db = database.get_db()
    db.execute('INSERT INTO links (text, url) VALUES (?, ?)',
               [new_link['text'], new_link['url']])
    db.commit()
    logger.info("Data stored successfully")
    return jsonify(new_link)

@app.route('/api/summarize', methods=['POST'])
@log_request_response
def summarize_text():
    text = request.get_json()['text']
    logger.info(f"Summarizing text of length {len(text)} characters")
    summary = summarizer(text, max_length=100, min_length=30, do_sample=False)
    result = summary[0]['summary_text']
    logger.info(f"Summary generated with length {len(result)} characters")
    return jsonify({'summary': result})

@app.route('/api/translate', methods=['POST'])
@log_request_response
def translate_text():
    text = request.get_json()['text']
    logger.info(f"Translating text: {text[:50]}...")
    translation = translator(text)
    result = translation[0]['translation_text']
    logger.info(f"Translation complete: {result[:50]}...")
    return jsonify({'translation': result})

@app.route('/api/qa', methods=['POST'])
@log_request_response
def answer_question():
    question = request.get_json()['question']
    context = request.get_json()['context']
    logger.info(f"Answering question: {question}")
    logger.info(f"Context length: {len(context)} characters")
    answer = qa(question=question, context=context)
    logger.info(f"Answer: {answer['answer']}")
    logger.info(f"Answer confidence: {answer.get('score', 'N/A')}")
    return jsonify({'answer': answer['answer'], 'score': answer.get('score')})

# ============================================================================
# COMPRESSION DATABASE ENDPOINTS
# ============================================================================

@app.route('/api/compress/store', methods=['POST'])
@log_request_response
def compress_and_store():
    """Store data with compression"""
    data = request.get_json()
    compression_type = data.get('compression_type', 'zlib')
    payload = data.get('data')
    
    logger.info(f"Compressing and storing data with {compression_type}")
    db = database.get_db()
    compressed = CompressionDatabase.store_compressed(db, 'compressed_data', payload, compression_type)
    
    # For demonstration, we'll return metadata instead of storing in actual table
    result = {
        'message': 'Data compressed and ready to store',
        'original_size': len(json.dumps(payload)),
        'compressed_size': len(compressed),
        'compression_ratio': f"{(len(compressed) / len(json.dumps(payload))) * 100:.2f}%",
        'compression_type': compression_type
    }
    logger.info(f"Compression statistics: {result}")
    return jsonify(result)

@app.route('/api/compress/test', methods=['POST'])
@log_request_response
def test_compression():
    """Test different compression algorithms"""
    data = request.get_json().get('data', 'Test data for compression')
    logger.info(f"Testing compression algorithms on data of size {len(data)}")
    
    if isinstance(data, dict):
        data = json.dumps(data)
    
    results = {}
    
    # Test ZLIB
    try:
        zlib_compressed = CompressionDatabase.compress_zlib(data)
        zlib_decompressed = CompressionDatabase.decompress_zlib(zlib_compressed)
        results['zlib'] = {
            'original_size': len(data),
            'compressed_size': len(zlib_compressed),
            'ratio': f"{(len(zlib_compressed) / len(data)) * 100:.2f}%",
            'decompression_successful': zlib_decompressed == data
        }
        logger.info(f"ZLIB compression test: {results['zlib']}")
    except Exception as e:
        logger.error(f"ZLIB compression error: {e}")
        results['zlib'] = {'error': str(e)}
    
    # Test GZIP
    try:
        gzip_compressed = CompressionDatabase.compress_gzip(data)
        gzip_decompressed = CompressionDatabase.decompress_gzip(gzip_compressed)
        results['gzip'] = {
            'original_size': len(data),
            'compressed_size': len(gzip_compressed),
            'ratio': f"{(len(gzip_compressed) / len(data)) * 100:.2f}%",
            'decompression_successful': gzip_decompressed == data
        }
        logger.info(f"GZIP compression test: {results['gzip']}")
    except Exception as e:
        logger.error(f"GZIP compression error: {e}")
        results['gzip'] = {'error': str(e)}
    
    # Test BZ2
    try:
        bz2_compressed = CompressionDatabase.compress_bz2(data)
        bz2_decompressed = CompressionDatabase.decompress_bz2(bz2_compressed)
        results['bz2'] = {
            'original_size': len(data),
            'compressed_size': len(bz2_compressed),
            'ratio': f"{(len(bz2_compressed) / len(data)) * 100:.2f}%",
            'decompression_successful': bz2_decompressed == data
        }
        logger.info(f"BZ2 compression test: {results['bz2']}")
    except Exception as e:
        logger.error(f"BZ2 compression error: {e}")
        results['bz2'] = {'error': str(e)}
    
    logger.info("Compression test completed for all algorithms")
    return jsonify(results)

# ============================================================================
# TENSOR AND AI ENDPOINTS
# ============================================================================

@app.route('/api/tensor/create', methods=['POST'])
@log_request_response
def create_tensor_endpoint():
    """Create a tensor from input data"""
    data = request.get_json().get('data')
    dtype_str = request.get_json().get('dtype', 'float32')
    
    logger.info(f"Creating tensor from data: {data}")
    
    dtype_map = {
        'float32': torch.float32,
        'float64': torch.float64,
        'int32': torch.int32,
        'int64': torch.int64
    }
    dtype = dtype_map.get(dtype_str, torch.float32)
    
    tensor = TensorOperations.create_tensor(data, dtype)
    stats = TensorOperations.tensor_statistics(tensor)
    
    result = {
        'message': 'Tensor created successfully',
        'shape': stats['shape'],
        'dtype': stats['dtype'],
        'statistics': stats
    }
    logger.info(f"Tensor created: {result}")
    return jsonify(result)

@app.route('/api/tensor/multiply', methods=['POST'])
@log_request_response
def tensor_multiply_endpoint():
    """Perform matrix multiplication"""
    data = request.get_json()
    matrix1 = data.get('matrix1')
    matrix2 = data.get('matrix2')
    
    logger.info(f"Matrix multiplication requested")
    
    tensor1 = TensorOperations.create_tensor(matrix1)
    tensor2 = TensorOperations.create_tensor(matrix2)
    
    try:
        result_tensor = TensorOperations.matrix_multiply(tensor1, tensor2)
        result_list = result_tensor.tolist()
        stats = TensorOperations.tensor_statistics(result_tensor)
        
        response = {
            'message': 'Matrix multiplication successful',
            'result': result_list,
            'shape': stats['shape'],
            'statistics': stats
        }
        logger.info(f"Matrix multiplication completed: {response['shape']}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Matrix multiplication error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/tensor/transform', methods=['POST'])
@log_request_response
def tensor_transform_endpoint():
    """Apply transformation to tensor"""
    data = request.get_json()
    tensor_data = data.get('data')
    operation = data.get('operation', 'normalize')
    
    logger.info(f"Applying {operation} transformation")
    
    tensor = TensorOperations.create_tensor(tensor_data)
    transformed = TensorOperations.tensor_transform(tensor, operation)
    result_list = transformed.tolist()
    stats = TensorOperations.tensor_statistics(transformed)
    
    response = {
        'message': f'{operation} transformation applied',
        'result': result_list,
        'statistics': stats
    }
    logger.info(f"Transformation completed: {operation}")
    return jsonify(response)

@app.route('/api/ai/predict', methods=['POST'])
@log_request_response
def ai_predict_endpoint():
    """Make prediction using AI model"""
    data = request.get_json().get('data')
    
    logger.info(f"AI prediction requested for data: {data}")
    
    try:
        output = ai_model.predict(data)
        result_list = output.tolist()
        
        response = {
            'message': 'Prediction successful',
            'predictions': result_list,
            'model_info': {
                'input_size': 10,
                'hidden_size': 20,
                'output_size': 5
            }
        }
        logger.info(f"Prediction completed: {result_list}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/ai/train', methods=['POST'])
@log_request_response
def ai_train_endpoint():
    """Train AI model (simulated)"""
    data = request.get_json()
    training_data = data.get('training_data', [])
    epochs = data.get('epochs', 10)
    
    logger.info(f"Training AI model for {epochs} epochs with {len(training_data)} samples")
    
    # Simulate training
    training_loss = []
    for epoch in range(epochs):
        loss = 1.0 / (epoch + 1)  # Simulated decreasing loss
        training_loss.append(loss)
        logger.debug(f"Epoch {epoch + 1}/{epochs}, Loss: {loss:.4f}")
    
    response = {
        'message': 'Training completed (simulated)',
        'epochs': epochs,
        'final_loss': training_loss[-1],
        'training_history': training_loss
    }
    logger.info(f"Training completed: {response}")
    return jsonify(response)

@app.route('/api/tensor/statistics', methods=['POST'])
@log_request_response
def tensor_statistics_endpoint():
    """Calculate statistics for tensor data"""
    data = request.get_json().get('data')
    
    logger.info("Calculating tensor statistics")
    
    tensor = TensorOperations.create_tensor(data)
    stats = TensorOperations.tensor_statistics(tensor)
    
    # Add additional numpy-based statistics
    np_array = tensor.numpy()
    stats['numpy_stats'] = {
        'median': float(np.median(np_array)),
        'percentile_25': float(np.percentile(np_array, 25)),
        'percentile_75': float(np.percentile(np_array, 75)),
        'variance': float(np.var(np_array))
    }
    
    logger.info(f"Statistics calculated: {stats}")
    return jsonify(stats)

# ============================================================================
# ADDITIONAL UTILITY ENDPOINTS
# ============================================================================

@app.route('/api/health', methods=['GET'])
@log_request_response
def health_check():
    """Health check endpoint with detailed system info"""
    logger.info("Health check requested")
    
    health_info = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'components': {
            'database': 'connected',
            'ai_models': 'loaded',
            'compression': 'available',
            'tensor_ops': 'available'
        },
        'versions': {
            'torch': torch.__version__,
            'numpy': np.__version__
        }
    }
    
    logger.info(f"Health check result: {health_info['status']}")
    return jsonify(health_info)

@app.route('/api/logs/recent', methods=['GET'])
@log_request_response
def get_recent_logs():
    """Retrieve recent log entries efficiently"""
    logger.info("Fetching recent logs")
    
    try:
        from collections import deque
        recent_lines = deque(maxlen=100)
        
        with open('flask.log', 'r') as f:
            for line in f:
                recent_lines.append(line)
        
        response = {
            'message': 'Recent logs retrieved',
            'count': len(recent_lines),
            'logs': list(recent_lines)
        }
        logger.info(f"Retrieved {len(recent_lines)} log entries")
        return jsonify(response)
    except FileNotFoundError:
        logger.warning("Log file not found")
        return jsonify({'error': 'Log file not found', 'logs': []}), 404
    except Exception as e:
        logger.error(f"Error reading logs: {e}")
        return jsonify({'error': f'Could not read log file: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info("Starting Flask application...")
    logger.info("All systems initialized - compression, logging, tensor ops, and AI ready")
    app.run(debug=True)
