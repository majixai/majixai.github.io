// slideshow-manager.js

class SlideshowManager {
    constructor(images) {
        this.images = images;
        this.currentIndex = 0;
        this.intervalId = null;
    }

    startSlideshow() {
        this.showImage();
    }

    showImage() {
        if (this.currentIndex >= this.images.length) {
            this.currentIndex = 0;
        }

        const image = this.images[this.currentIndex];
        console.log(`Showing image: ${image}`);

        // Generate a random time delay between 1 and 5 seconds
        const randomDelay = Math.floor(Math.random() * 5000) + 1000;
        this.intervalId = setTimeout(() => {
            this.currentIndex++;
            this.showImage();
        }, randomDelay);
    }

    stopSlideshow() {
        clearTimeout(this.intervalId);
    }
}

// Example usage:
// const images = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
// const manager = new SlideshowManager(images);
// manager.startSlideshow();
