export class Contact {
    constructor({ id, name, connections }) {
        this.id = id || Date.now();
        this.name = name;
        this.connections = connections || [];
    }
}
