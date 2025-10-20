function Logger(target, key, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args) {
        console.log(`Calling ${key} with arguments:`, args);
        const result = originalMethod.apply(this, args);
        console.log(`Method ${key} returned:`, result);
        return result;
    };

    return descriptor;
}
