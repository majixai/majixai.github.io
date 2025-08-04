import { StorageService } from './StorageService.js';
import { NamedEntity } from './NamedEntity.js';
import { Link } from './Link.js';
import { NotificationService } from './NotificationService.js';

export class EntityManager {
    #entities;

    constructor(uiManager) {
        this.uiManager = uiManager;
        this.#entities = [];
        this.storageKey = 'entities';
    }

    async loadEntities() {
        const entitiesData = await StorageService.get(this.storageKey);
        this.loadFromData(entitiesData);
    }

    loadFromData(data) {
        this.#entities = data.map(d => new NamedEntity(d));
        this.uiManager.renderEntities(this.#entities);
    }

    async addLinkToEntity(entityName, section, linkData) {
        let entity = this.getEntityByName(entityName);
        if (!entity) {
            entity = new NamedEntity({ name: entityName });
            this.#entities.push(entity);
        }

        if (!entity.sections[section]) {
            entity.sections[section] = [];
        }

        const newLink = new Link(linkData);
        entity.sections[section].push(newLink);

        await StorageService.save(this.storageKey, this.#entities);
        this.uiManager.renderEntities(this.#entities);
        NotificationService.showSuccess('Link added successfully!');
    }

    getEntityByName(name) {
        return this.#entities.find(entity => entity.name === name);
    }

    getAllEntities() {
        return this.#entities;
    }
}
