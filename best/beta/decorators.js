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
