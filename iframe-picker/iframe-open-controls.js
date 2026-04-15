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
        },

        shouldIgnoreCardClick(target, extraIgnoreSelectors = []) {
            if (this.isOpenButtonTarget(target)) return true;
            if (!target || !target.closest || !Array.isArray(extraIgnoreSelectors)) return false;
            return extraIgnoreSelectors.some((selector) => Boolean(selector && target.closest(selector)));
        },

        bindOpenButton(container, onOpen) {
            const openBtn = container?.querySelector?.('.open-iframe-btn');
            if (!openBtn || typeof onOpen !== 'function') return false;
            if (openBtn.dataset.iframeOpenBound === '1') return true;

            openBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                onOpen(event);
            });
            openBtn.dataset.iframeOpenBound = '1';
            return true;
        }
    };

    window.IframeOpenControls = IframeOpenControls;
})(window);
