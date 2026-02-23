function logExecutionTime(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
        const start = performance.now();
        const result = await originalMethod.apply(this, args);
        const end = performance.now();
        console.log(`[${propertyKey}] Execution time: ${end - start}ms`);
        return result;
    };
    return descriptor;
}

function throttle(limitMs) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        let lastCallTime = 0;
        descriptor.value = function (...args) {
            const now = Date.now();
            if (now - lastCallTime < limitMs) {
                return null;
            }
            lastCallTime = now;
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}

function retry(maxAttempts, delayMs) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error) {
                    console.log(`[${propertyKey}] Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
                    if (attempt === maxAttempts) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        };
        return descriptor;
    };
}

function memoize(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map();
    descriptor.value = async function (...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = await originalMethod.apply(this, args);
        cache.set(key, result);
        return result;
    };
    return descriptor;
}
