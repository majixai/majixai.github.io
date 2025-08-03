export class Contact {
    constructor({ id, name, connections, attachments }) {
        this.id = id || Date.now();
        this.name = name;
        this.connections = connections || [];
        this.attachments = attachments || [];
    }
}
