import DataService from './services/DataService.js';
import UIRenderer from './ui/UIRenderer.js';
import { log, timingDecorator } from './utils/Logger.js';

const AppController = (function() {
    // Private members
    let _dataService;
    let _uiRenderer;
    let _isAnimationPaused = false;

    // Private methods
    function _setupEventListeners() {
        document.getElementById('toggle-animation').addEventListener('click', () => {
            _isAnimationPaused = !_isAnimationPaused;
            document.body.classList.toggle('animation-paused', _isAnimationPaused);
            log(`Animations ${_isAnimationPaused ? 'paused' : 'resumed'}`);
        });
    }

    // Decorated loadData method
    const decoratedLoadData = timingDecorator(async (dataType) => {
        try {
            _uiRenderer.renderLoading();
            const data = await _dataService.fetchData(dataType);
            _uiRenderer.renderData(data);
        } catch (error) {
            _uiRenderer.renderError(error);
            console.error('Error loading data:', error);
        }
    }, 'loadData');

    // Public interface
    return {
        // Hook
        init: function() {
            _dataService = new DataService();
            _uiRenderer = new UIRenderer('output');
            _setupEventListeners();
            log('App initialized.');
            // Callback example
            _uiRenderer.onRenderComplete(() => {
                log('Initial render complete.');
            });
        },
        loadData: decoratedLoadData
    };
})();

// Initialize the app
AppController.init();

// Expose to global scope for HTML onclick handlers
window.app = {
    loadData: AppController.loadData
};
