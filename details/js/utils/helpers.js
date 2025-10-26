/**
 * An iterator for a range of numbers.
 * @param {number} start
 * @param {number} end
 * @param {number} step
 * @returns {Iterable<number>}
 */
export function range(start, end, step = 1) {
    return {
        [Symbol.iterator]: function*() {
            for (let i = start; i < end; i += step) {
                yield i;
            }
        }
    };
}

/**
 * A generator function that yields items from an array with a delay.
 * Useful for demonstrating async generators (though not used directly in this app).
 * @param {Array<any>} array
 * @param {number} delay
 */
export async function* asyncGenerator(array, delay = 100) {
    for (const item of array) {
        await new Promise(resolve => setTimeout(resolve, delay));
        yield item;
    }
}
