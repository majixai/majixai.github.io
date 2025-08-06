class Autoscroller {
    constructor(onlineUsersDiv, previousUsersDiv, playPauseButton, speedSlider) {
        this.onlineUsersDiv = onlineUsersDiv;
        this.previousUsersDiv = previousUsersDiv;
        this.playPauseButton = playPauseButton;
        this.speedSlider = speedSlider;
        this.interval = null;
    }

    *userTicker() {
        const onlineUsers = Array.from(this.onlineUsersDiv.querySelectorAll('.user-info'));
        const previousUsers = Array.from(this.previousUsersDiv.querySelectorAll('.user-info'));
        const allUsers = onlineUsers.concat(previousUsers);
        let index = 0;
        while (true) {
            yield allUsers[index];
            index = (index + 1) % allUsers.length;
        }
    }

    start() {
        const ticker = this.userTicker();
        const speed = this.speedSlider.value;
        const interval = 1100 - (speed * 100);
        this.interval = setInterval(() => {
            const user = ticker.next().value;
            if (user) {
                user.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, interval);
        this.playPauseButton.textContent = 'Pause';
    }

    stop() {
        clearInterval(this.interval);
        this.interval = null;
        this.playPauseButton.textContent = 'Play';
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
}
