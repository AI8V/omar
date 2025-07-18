'use strict';

/**
 * @file toast-utility.js
 * @description A centralized utility for creating and showing Bootstrap 5 toasts.
 */

/**
 * Displays a Bootstrap toast notification.
 * @param {string} message The message to display inside the toast.
 * @param {string} [type='info'] The type of toast. Can be 'success', 'danger', 'warning', or 'info'.
 */
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        console.error('Toast container not found.');
        // Fallback to alert if container is missing
        alert(message);
        return;
    }

    let iconHtml;
    let toastClass;

    switch (type) {
        case 'success':
            iconHtml = '<i class="bi bi-check-circle-fill ms-2"></i>';
            toastClass = 'bg-success text-white';
            break;
        case 'danger':
            iconHtml = '<i class="bi bi-x-octagon-fill ms-2"></i>';
            toastClass = 'bg-danger text-white';
            break;
        case 'warning':
            iconHtml = '<i class="bi bi-exclamation-triangle-fill ms-2"></i>';
            toastClass = 'bg-warning text-dark';
            break;
        default: // 'info'
            iconHtml = '<i class="bi bi-info-circle-fill ms-2"></i>';
            toastClass = 'bg-info text-dark';
            break;
    }
    
    // Create a unique ID for each toast
    const toastId = 'toast-' + Date.now();

    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center ${toastClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${iconHtml}
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white ms-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    
    // Clean up the DOM after the toast is hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });

    toast.show();
}