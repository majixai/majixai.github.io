/**
 * @typedef {import('../types.js').IProduct} IProduct
 */

// Bitwise feature flags
const FEATURES = {
    NONE: 0,    // 0000
    BASIC: 1,   // 0001
    PREMIUM: 2, // 0010
    PRO: 4,     // 0100
    ENTERPRISE: 8 // 1000
};

class DataMapper {
    /**
     * Static method demonstrating object mapping and bitwise operations.
     * @param {object} rawData
     * @returns {IProduct}
     */
    static mapProduct(rawData) {
        return {
            id: rawData.id,
            name: rawData.name,
            price: rawData.price,
            features: rawData.features,
            hasFeature: function(feature) {
                return (this.features & feature) === feature;
            }
        };
    }

    static get FEATURES() {
        return FEATURES;
    }
}

export default DataMapper;
