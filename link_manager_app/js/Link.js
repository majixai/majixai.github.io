export class Link {
    constructor({ id, name, link, section, isEnabled, tradesPerDay, complete, ip, notes }) {
        this.id = id || Date.now();
        this.name = name;
        this.link = link;
        this.section = section;
        this.isEnabled = isEnabled === undefined ? true : isEnabled;
        this.complete = complete || false;
        this.ip = ip || false;
        this.notes = notes || '';
        if (this.section === 'investing') {
            this.tradesPerDay = tradesPerDay || 1;
        }
    }
}
