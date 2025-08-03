export class StorageService {
    static async get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : [];
        } catch (error) {
            console.error(`Error getting item from localStorage: ${key}`, error);
            return [];
        }
    }

    static async save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error(`Error saving item to localStorage: ${key}`, error);
        }
    }
}
