class Autoscroller {
    constructor(onlineUsersDiv, previousUsersDiv, playPauseButton, speedSlider) {
        this.onlineUsersDiv = onlineUsersDiv;
        this.previousUsersDiv = previousUsersDiv;
        this.playPauseButton = playPauseButton;
        this.speedSlider = speedSlider;
        this.interval = null;
        this.direction = 1;
        this.currentIndex = 0;
        this.lastUsersSignature = '';
    }

    getUsers() {
        const onlineUsers = Array.from(this.onlineUsersDiv.querySelectorAll('.user-info'));
        const previousUsers = Array.from(this.previousUsersDiv.querySelectorAll('.user-info'));
        return onlineUsers.concat(previousUsers);
    }

    getNextUser() {
        const allUsers = this.getUsers();
        if (allUsers.length === 0) return null;
        const signature = allUsers.map((el) => el?.dataset?.username || '').join('|');
        if (signature !== this.lastUsersSignature) {
            this.currentIndex = 0;
            this.lastUsersSignature = signature;
        }
        if (this.currentIndex >= allUsers.length || this.currentIndex < 0) {
            this.currentIndex = 0;
        }
        const user = allUsers[this.currentIndex];
        this.currentIndex = this.wrapIndex(this.currentIndex + this.direction, allUsers.length);
        return user;
    }

    wrapIndex(index, length) {
        return ((index % length) + length) % length;
    }

    start() {
        const speed = this.speedSlider.value;
        const interval = 1100 - (speed * 100);
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            const user = this.getNextUser();
            if (user) {
                user.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, interval);
        this.playPauseButton.textContent = '⏸ Pause';
    }

    stop() {
        clearInterval(this.interval);
        this.interval = null;
        this.playPauseButton.textContent = '▶ Play';
    }

    toggle() {
        if (this.interval) {
            this.stop();
        } else {
            this.start();
        }
    }

    onSpeedChange() {
        if (this.interval) {
            this.stop();
            this.start();
        }
    }

    reverse() {
        this.direction *= -1;
    }

    startOver() {
        this.currentIndex = 0;
        const firstUser = this.getUsers()[0];
        if (firstUser) {
            firstUser.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}
