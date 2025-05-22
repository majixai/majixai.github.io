document.addEventListener('DOMContentLoaded', () => {
    const referralLinkInput = document.getElementById('referralLink');
    const copyButton = document.getElementById('copyButton');
    const animationDiv1 = document.getElementById('animationDiv1');
    const animationDiv2 = document.getElementById('animationDiv2');

    // 1. Referral Link Handling
    if (referralLinkInput) {
        const uniqueID = 'USER' + Date.now(); // Make it more user-friendly
        referralLinkInput.value = `https://example.com/join?ref=${uniqueID}`;
    }

    if (copyButton && referralLinkInput) {
        copyButton.addEventListener('click', () => {
            referralLinkInput.select();
            referralLinkInput.setSelectionRange(0, 99999); // For mobile devices

            navigator.clipboard.writeText(referralLinkInput.value)
                .then(() => {
                    const originalButtonText = copyButton.textContent;
                    copyButton.textContent = 'Copied!';
                    copyButton.classList.add('copied'); // For styling feedback

                    // Trigger animation on copy
                    if (animationDiv1) {
                        animationDiv1.style.animation = 'none'; // Reset animation
                        void animationDiv1.offsetWidth; // Trigger reflow
                        animationDiv1.style.animation = 'bounce 0.8s infinite alternate'; // Restart
                    }
                     if (animationDiv2) {
                        // Add a class to trigger sparkle or make it more intense
                        animationDiv2.classList.add('active-sparkle');
                        setTimeout(() => {
                            animationDiv2.classList.remove('active-sparkle');
                        }, 1500); // Corresponds to sparkle animation time
                    }


                    setTimeout(() => {
                        copyButton.textContent = originalButtonText;
                        copyButton.classList.remove('copied');
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    // Fallback for older browsers
                    try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                            const originalButtonText = copyButton.textContent;
                            copyButton.textContent = 'Copied!';
                            copyButton.classList.add('copied');
                            setTimeout(() => {
                                copyButton.textContent = originalButtonText;
                                copyButton.classList.remove('copied');
                            }, 2000);
                        } else {
                            alert('Failed to copy. Please copy manually.');
                        }
                    } catch (fallbackErr) {
                        console.error('Fallback copy method also failed:', fallbackErr);
                        alert('Failed to copy. Please copy manually.');
                    }
                });
        });
    }

    const container = document.querySelector('.container');
    if (container && animationDiv2) {
        container.addEventListener('mouseenter', () => {
            // animationDiv2.style.animationPlayState = 'running'; 
        });
        container.addEventListener('mouseleave', () => {
            // animationDiv2.style.animationPlayState = 'paused';
        });
    }
});
