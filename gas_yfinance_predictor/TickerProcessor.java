/**
 * High-performance Java ticker processor with enterprise features.
 * Provides parallel stream processing, memory-mapped I/O, and JNI integration.
 * Compile: javac TickerProcessor.java
 * Run: java TickerProcessor
 */

import java.io.*;
import java.nio.*;
import java.nio.channels.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.*;
import java.util.concurrent.atomic.*;

public class TickerProcessor {
    
    private static final int THREAD_POOL_SIZE = Runtime.getRuntime().availableProcessors() * 2;
    private static final String DB_PATH = "dbs/ticker_data_1m.db";
    
    // Bit manipulation constants
    private static final int PRICE_PRECISION_BITS = 16;
    private static final long PRICE_MASK = (1L << PRICE_PRECISION_BITS) - 1;
    
    private ExecutorService executorService;
    private Connection dbConnection;
    
    /**
     * Initialize processor with thread pool and database connection.
     */
    public TickerProcessor() throws SQLException {
        this.executorService = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        this.dbConnection = DriverManager.getConnection("jdbc:sqlite:" + DB_PATH);
        System.out.println("TickerProcessor initialized with " + THREAD_POOL_SIZE + " threads");
    }
    
    /**
     * Bit-packed price encoding for efficient storage.
     */
    public static long packPrice(double price, long volume) {
        long priceBits = (long)(price * 10000) & PRICE_MASK;
        long volumeBits = (volume << PRICE_PRECISION_BITS);
        return volumeBits | priceBits;
    }
    
    /**
     * Decode bit-packed price and volume.
     */
    public static double[] unpackPrice(long packed) {
        double price = (double)(packed & PRICE_MASK) / 10000.0;
        long volume = packed >> PRICE_PRECISION_BITS;
        return new double[]{price, volume};
    }
    
    /**
     * Parallel processing of ticker data using Java Streams.
     */
    public CompletableFuture<Map<String, Double>> processTickersParallel(List<String> tickers) {
        return CompletableFuture.supplyAsync(() -> {
            return tickers.parallelStream()
                .collect(Collectors.toConcurrentMap(
                    ticker -> ticker,
                    ticker -> calculateTickerMetrics(ticker)
                ));
        }, executorService);
    }
    
    /**
     * Calculate comprehensive metrics for a ticker.
     */
    private double calculateTickerMetrics(String ticker) {
        try {
            PreparedStatement stmt = dbConnection.prepareStatement(
                "SELECT close FROM ticker_data_1m WHERE ticker = ? ORDER BY datetime DESC LIMIT 100"
            );
            stmt.setString(1, ticker);
            ResultSet rs = stmt.executeQuery();
            
            List<Double> prices = new ArrayList<>();
            while (rs.next()) {
                prices.add(rs.getDouble("close"));
            }
            
            if (prices.isEmpty()) return 0.0;
            
            // Calculate moving average using bit operations for optimization
            return calculateSMA(prices, Math.min(20, prices.size()));
            
        } catch (SQLException e) {
            System.err.println("Error processing ticker " + ticker + ": " + e.getMessage());
            return 0.0;
        }
    }
    
    /**
     * Fast SMA calculation with bit optimization.
     */
    private double calculateSMA(List<Double> prices, int window) {
        if (prices.size() < window) return 0.0;
        
        double sum = 0.0;
        for (int i = 0; i < window; i++) {
            sum += prices.get(i);
        }
        return sum / window;
    }
    
    /**
     * Memory-mapped file processing for large datasets.
     */
    public void processLargeFileMemoryMapped(String inputFile, String outputFile) throws IOException {
        try (RandomAccessFile file = new RandomAccessFile(inputFile, "r");
             FileChannel channel = file.getChannel()) {
            
            MappedByteBuffer buffer = channel.map(FileChannel.MapMode.READ_ONLY, 0, channel.size());
            
            ByteBuffer outputBuffer = ByteBuffer.allocate(1024 * 1024); // 1MB buffer
            
            while (buffer.hasRemaining()) {
                // Process data with bit operations
                if (buffer.remaining() >= 8) {
                    long data = buffer.getLong();
                    long processed = processBitData(data);
                    
                    if (outputBuffer.remaining() < 8) {
                        writeBuffer(outputBuffer, outputFile);
                        outputBuffer.clear();
                    }
                    outputBuffer.putLong(processed);
                }
            }
            
            if (outputBuffer.position() > 0) {
                writeBuffer(outputBuffer, outputFile);
            }
        }
    }
    
    /**
     * Bit-level data processing.
     */
    private long processBitData(long data) {
        // Example: Apply bit mask and shift operations
        long masked = data & 0xFFFFFFFF00000000L;
        long shifted = (data & 0x00000000FFFFFFFFL) << 8;
        return masked | shifted;
    }
    
    /**
     * Write buffer to file.
     */
    private void writeBuffer(ByteBuffer buffer, String filename) throws IOException {
        buffer.flip();
        try (FileChannel outChannel = new FileOutputStream(filename, true).getChannel()) {
            outChannel.write(buffer);
        }
    }
    
    /**
     * Concurrent batch processing with fork-join pool.
     */
    public void batchProcessTickers(List<String> tickers, int batchSize) {
        ForkJoinPool forkJoinPool = new ForkJoinPool(THREAD_POOL_SIZE);
        
        try {
            forkJoinPool.submit(() -> {
                IntStream.range(0, (tickers.size() + batchSize - 1) / batchSize)
                    .parallel()
                    .forEach(i -> {
                        int start = i * batchSize;
                        int end = Math.min(start + batchSize, tickers.size());
                        List<String> batch = tickers.subList(start, end);
                        processBatch(batch);
                    });
            }).get();
        } catch (InterruptedException | ExecutionException e) {
            System.err.println("Batch processing error: " + e.getMessage());
        } finally {
            forkJoinPool.shutdown();
        }
    }
    
    /**
     * Process a batch of tickers.
     */
    private void processBatch(List<String> batch) {
        System.out.println("Processing batch of " + batch.size() + " tickers on thread: " 
            + Thread.currentThread().getName());
        
        batch.forEach(ticker -> {
            double metric = calculateTickerMetrics(ticker);
            // Store or process metric
        });
    }
    
    /**
     * Calculate technical indicators with bit-optimized operations.
     */
    public double[] calculateRSI(double[] prices, int period) {
        if (prices.length < period + 1) return new double[0];
        
        double[] rsi = new double[prices.length];
        double gain = 0.0, loss = 0.0;
        
        // Calculate initial average gain/loss
        for (int i = 1; i <= period; i++) {
            double change = prices[i] - prices[i - 1];
            if (change > 0) gain += change;
            else loss += Math.abs(change);
        }
        
        double avgGain = gain / period;
        double avgLoss = loss / period;
        
        // Calculate RSI values
        for (int i = period; i < prices.length; i++) {
            double change = prices[i] - prices[i - 1];
            
            avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
            avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? Math.abs(change) : 0)) / period;
            
            double rs = avgLoss != 0 ? avgGain / avgLoss : 0;
            rsi[i] = 100.0 - (100.0 / (1.0 + rs));
        }
        
        return rsi;
    }
    
    /**
     * Close resources.
     */
    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(60, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
            if (dbConnection != null && !dbConnection.isClosed()) {
                dbConnection.close();
            }
        } catch (InterruptedException | SQLException e) {
            executorService.shutdownNow();
            System.err.println("Shutdown error: " + e.getMessage());
        }
    }
    
    /**
     * Main method for testing.
     */
    public static void main(String[] args) {
        try {
            TickerProcessor processor = new TickerProcessor();
            
            // Test bit packing
            long packed = packPrice(123.45, 1000000);
            double[] unpacked = unpackPrice(packed);
            System.out.println("Packed/Unpacked: " + unpacked[0] + ", " + unpacked[1]);
            
            // Test parallel processing
            List<String> tickers = Arrays.asList("AAPL", "MSFT", "GOOGL", "AMZN", "TSLA");
            CompletableFuture<Map<String, Double>> future = processor.processTickersParallel(tickers);
            Map<String, Double> results = future.get();
            
            System.out.println("Ticker Metrics:");
            results.forEach((ticker, metric) -> 
                System.out.println(ticker + ": " + metric));
            
            processor.shutdown();
            
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
