(function (window) {
    'use strict';

    const DEFAULT_ICON = '📺';

    const IframeOpenControls = {
        buildOpenButtonHTML(options = {}) {
            const icon = typeof options.icon === 'string' && options.icon.trim() ? options.icon.trim() : DEFAULT_ICON;
            const title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : 'Open performer in iframe';
            const extraClass = typeof options.extraClass === 'string' && options.extraClass.trim() ? ` ${options.extraClass.trim()}` : '';
            return `<button type="button" class="open-iframe-btn${extraClass}" title="${title}" aria-label="${title}">${icon}</button>`;
        },

        isOpenButtonTarget(target) {
            return Boolean(target && target.closest && target.closest('.open-iframe-btn'));
        }
    };

    window.IframeOpenControls = IframeOpenControls;
})(window);
