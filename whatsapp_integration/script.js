document.addEventListener('DOMContentLoaded', () => {
    const openWhatsAppButton = document.getElementById('openWhatsApp');
    const whatsappFrame = document.getElementById('whatsappFrame');
    const whatsAppWebUrl = 'https://web.whatsapp.com/';

    openWhatsAppButton.addEventListener('click', () => {
        // Check if the iframe is already loading WhatsApp to prevent multiple loads
        if (whatsappFrame.src !== whatsAppWebUrl) {
            whatsappFrame.src = whatsAppWebUrl;
        }
    });
});
