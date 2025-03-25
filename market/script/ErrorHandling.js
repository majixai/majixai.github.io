export function handleFetchError(error) {
    alert(`There has been a problem with your fetch operation: ${error.message}`);
    copyToClipboard(error.message);
}

export function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Error message copied to clipboard.');
}
