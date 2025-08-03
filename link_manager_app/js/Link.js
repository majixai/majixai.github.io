export class Link {
    constructor({ id, name, link, section, isEnabled, tradesPerDay }) {
        this.id = id || Date.now();
        this.name = name;
        this.link = link;
        this.section = section;
        this.isEnabled = isEnabled === undefined ? true : isEnabled;
        if (this.section === 'investing') {
            this.tradesPerDay = tradesPerDay;
        }
    }
}
