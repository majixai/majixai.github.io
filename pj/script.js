$(document).ready(function() {

    // Use event delegation for click handling on thumbnail items
    $('.thumbnails-scroll').on('click', '.thumbnail-item', function() {
        // Get the video data from the clicked item's data attributes
        const embedUrl = $(this).data('embed-url');
        const videoTitle = $(this).data('title');

        // Update the iframe's src attribute
        if (embedUrl) {
            $('#video-iframe').attr('src', embedUrl);
        } else {
            // Optional: Handle cases where the URL might be missing
            console.warn("Embed URL not found for this item.");
            // You could clear the iframe or show a default message:
            // $('#video-iframe').attr('src', '');
        }

        // Update the title display
        if (videoTitle) {
            $('#video-title').text(videoTitle);
        } else {
            $('#video-title').text(''); // Clear title if none provided
        }

        // Optional: Scroll the window to the video player smoothly
        // $('html, body').animate({
        //    scrollTop: $(".video-player-container").offset().top - 20 // Adjust offset as needed
        // }, 500); // 500ms animation speed

    });

    // Optional: Add a visual cue for the currently "selected" thumbnail
    $('.thumbnails-scroll').on('click', '.thumbnail-item', function() {
        $('.thumbnail-item').css('border-color', '#ddd'); // Reset others
        $(this).css('border-color', '#007bff'); // Highlight clicked one
    });

});
