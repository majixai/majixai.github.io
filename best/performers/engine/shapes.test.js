/**
 * @file Tests for the ShapeEngine class.
 * @description Unit tests for shape overlay engine functionality.
 * Run in browser console or via a test runner that supports DOM APIs.
 */

// --- Basic Test Framework (reused pattern from jinx_strategy/menu/menu.test.js) ---
const TestSuite = {
    tests: [],
    totalTests: 0,
    passed: 0,
    failed: 0,
    currentGroup: '',

    group(name, fn) {
        this.currentGroup = name;
        console.log(`%c--- Test Group: ${name} ---`, 'color: blue; font-weight: bold;');
        fn();
        this.currentGroup = '';
    },

    test(name, fn) {
        this.totalTests++;
        const fullName = this.currentGroup ? `${this.currentGroup} > ${name}` : name;
        try {
            fn();
            console.log(`%c  [PASS] ${fullName}`, 'color: green;');
            this.passed++;
        } catch (e) {
            console.error(`%c  [FAIL] ${fullName}`, 'color: red;');
            console.error(e);
            this.failed++;
        }
    },

    assertEquals(expected, actual, message = 'assertEquals') {
        if (expected !== actual) {
            throw new Error(`${message}: Expected "${expected}" but got "${actual}"`);
        }
    },

    assertDeepEquals(expected, actual, message = 'assertDeepEquals') {
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error(`${message}: Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
    },

    assertTrue(condition, message = 'assertTrue') {
        if (!condition) {
            throw new Error(`${message}: Expected true but got false`);
        }
    },

    assertFalse(condition, message = 'assertFalse') {
        if (condition) {
            throw new Error(`${message}: Expected false but got true`);
        }
    },

    assertNotNull(value, message = 'assertNotNull') {
        if (value === null || value === undefined) {
            throw new Error(`${message}: Expected not null but got ${value}`);
        }
    },

    summarize() {
        console.log(`%c\n========== Test Summary ==========`, 'font-weight: bold;');
        console.log(`%c  Total: ${this.totalTests}`, 'font-weight: bold;');
        console.log(`%c  Passed: ${this.passed}`, 'color: green; font-weight: bold;');
        console.log(`%c  Failed: ${this.failed}`, this.failed > 0 ? 'color: red; font-weight: bold;' : 'color: green; font-weight: bold;');
        console.log(`%c==================================\n`, 'font-weight: bold;');
        return { total: this.totalTests, passed: this.passed, failed: this.failed };
    }
};

// ==================== Tests ====================

TestSuite.group('ShapeEngine Constructor', () => {
    TestSuite.test('creates instance with default config', () => {
        const engine = new ShapeEngine();
        TestSuite.assertFalse(engine.shapesEnabled);
        TestSuite.assertFalse(engine.mlShapesEnabled);
        TestSuite.assertEquals('many', engine.performerMode);
        TestSuite.assertEquals(3, engine.complexity);
    });

    TestSuite.test('creates instance with custom config', () => {
        const engine = new ShapeEngine({
            shapesEnabled: true,
            mlShapesEnabled: true,
            performerMode: 'single',
            complexity: 7
        });
        TestSuite.assertTrue(engine.shapesEnabled);
        TestSuite.assertTrue(engine.mlShapesEnabled);
        TestSuite.assertEquals('single', engine.performerMode);
        TestSuite.assertEquals(7, engine.complexity);
    });

    TestSuite.test('merges partial config with defaults', () => {
        const engine = new ShapeEngine({ shapesEnabled: true });
        TestSuite.assertTrue(engine.shapesEnabled);
        TestSuite.assertFalse(engine.mlShapesEnabled);
        TestSuite.assertEquals('many', engine.performerMode);
    });
});

TestSuite.group('ShapeEngine Static Properties', () => {
    TestSuite.test('SHAPE_TYPES is frozen array with expected shapes', () => {
        TestSuite.assertTrue(Object.isFrozen(ShapeEngine.SHAPE_TYPES));
        TestSuite.assertTrue(ShapeEngine.SHAPE_TYPES.length >= 10);
        TestSuite.assertTrue(ShapeEngine.SHAPE_TYPES.includes('circle'));
        TestSuite.assertTrue(ShapeEngine.SHAPE_TYPES.includes('star'));
        TestSuite.assertTrue(ShapeEngine.SHAPE_TYPES.includes('hexagon'));
        TestSuite.assertTrue(ShapeEngine.SHAPE_TYPES.includes('spiral'));
    });

    TestSuite.test('PERFORMER_MODES includes none, single, many', () => {
        TestSuite.assertTrue(Object.isFrozen(ShapeEngine.PERFORMER_MODES));
        TestSuite.assertDeepEquals(['none', 'single', 'many'], [...ShapeEngine.PERFORMER_MODES]);
    });

    TestSuite.test('DEFAULT_CONFIG is frozen', () => {
        TestSuite.assertTrue(Object.isFrozen(ShapeEngine.DEFAULT_CONFIG));
        TestSuite.assertFalse(ShapeEngine.DEFAULT_CONFIG.shapesEnabled);
        TestSuite.assertFalse(ShapeEngine.DEFAULT_CONFIG.mlShapesEnabled);
        TestSuite.assertEquals('many', ShapeEngine.DEFAULT_CONFIG.performerMode);
    });
});

TestSuite.group('ShapeEngine Property Setters', () => {
    TestSuite.test('shapesEnabled setter converts to boolean', () => {
        const engine = new ShapeEngine();
        engine.shapesEnabled = true;
        TestSuite.assertTrue(engine.shapesEnabled);
        engine.shapesEnabled = false;
        TestSuite.assertFalse(engine.shapesEnabled);
        engine.shapesEnabled = 1;
        TestSuite.assertTrue(engine.shapesEnabled);
        engine.shapesEnabled = 0;
        TestSuite.assertFalse(engine.shapesEnabled);
    });

    TestSuite.test('mlShapesEnabled setter converts to boolean', () => {
        const engine = new ShapeEngine();
        engine.mlShapesEnabled = true;
        TestSuite.assertTrue(engine.mlShapesEnabled);
        engine.mlShapesEnabled = false;
        TestSuite.assertFalse(engine.mlShapesEnabled);
    });

    TestSuite.test('performerMode only accepts valid modes', () => {
        const engine = new ShapeEngine();
        engine.performerMode = 'none';
        TestSuite.assertEquals('none', engine.performerMode);
        engine.performerMode = 'single';
        TestSuite.assertEquals('single', engine.performerMode);
        engine.performerMode = 'many';
        TestSuite.assertEquals('many', engine.performerMode);
        engine.performerMode = 'invalid';
        TestSuite.assertEquals('many', engine.performerMode); // Should remain unchanged
    });

    TestSuite.test('complexity clamps between 1 and 10', () => {
        const engine = new ShapeEngine();
        engine.complexity = 5;
        TestSuite.assertEquals(5, engine.complexity);
        engine.complexity = 0;
        TestSuite.assertEquals(1, engine.complexity);
        engine.complexity = 15;
        TestSuite.assertEquals(10, engine.complexity);
        engine.complexity = -1;
        TestSuite.assertEquals(1, engine.complexity);
    });
});

TestSuite.group('ShapeEngine getConfig', () => {
    TestSuite.test('returns current configuration object', () => {
        const engine = new ShapeEngine({
            shapesEnabled: true,
            mlShapesEnabled: true,
            performerMode: 'single',
            complexity: 8
        });
        const config = engine.getConfig();
        TestSuite.assertTrue(config.shapesEnabled);
        TestSuite.assertTrue(config.mlShapesEnabled);
        TestSuite.assertEquals('single', config.performerMode);
        TestSuite.assertEquals(8, config.complexity);
    });

    TestSuite.test('config reflects runtime changes', () => {
        const engine = new ShapeEngine();
        engine.shapesEnabled = true;
        engine.performerMode = 'none';
        engine.complexity = 6;
        const config = engine.getConfig();
        TestSuite.assertTrue(config.shapesEnabled);
        TestSuite.assertEquals('none', config.performerMode);
        TestSuite.assertEquals(6, config.complexity);
    });
});

TestSuite.group('ShapeEngine Overlay Management', () => {
    TestSuite.test('applyOverlay does nothing when shapes disabled', () => {
        const engine = new ShapeEngine({ shapesEnabled: false });
        const div = document.createElement('div');
        div.style.width = '200px';
        div.style.height = '150px';
        document.body.appendChild(div);
        engine.applyOverlay(div, 'test-key');
        const canvas = div.querySelector('.shape-overlay-canvas');
        TestSuite.assertTrue(canvas === null);
        document.body.removeChild(div);
    });

    TestSuite.test('applyOverlay creates canvas when shapes enabled', () => {
        const engine = new ShapeEngine({ shapesEnabled: true, animateShapes: false });
        const div = document.createElement('div');
        div.style.width = '200px';
        div.style.height = '150px';
        div.style.position = 'relative';
        document.body.appendChild(div);
        engine.applyOverlay(div, 'test-canvas');
        const canvas = div.querySelector('.shape-overlay-canvas');
        TestSuite.assertNotNull(canvas);
        TestSuite.assertEquals('test-canvas', canvas.dataset.shapeKey);
        engine.removeAllOverlays();
        document.body.removeChild(div);
    });

    TestSuite.test('removeOverlay removes canvas from DOM', () => {
        const engine = new ShapeEngine({ shapesEnabled: true, animateShapes: false });
        const div = document.createElement('div');
        div.style.width = '200px';
        div.style.height = '150px';
        div.style.position = 'relative';
        document.body.appendChild(div);
        engine.applyOverlay(div, 'remove-test');
        TestSuite.assertNotNull(div.querySelector('.shape-overlay-canvas'));
        engine.removeOverlay('remove-test');
        TestSuite.assertTrue(div.querySelector('.shape-overlay-canvas') === null);
        document.body.removeChild(div);
    });

    TestSuite.test('removeAllOverlays clears all overlays', () => {
        const engine = new ShapeEngine({ shapesEnabled: true, animateShapes: false });
        const container = document.createElement('div');
        container.style.position = 'relative';
        document.body.appendChild(container);

        const div1 = document.createElement('div');
        div1.style.cssText = 'width:100px;height:100px;position:relative;';
        container.appendChild(div1);
        const div2 = document.createElement('div');
        div2.style.cssText = 'width:100px;height:100px;position:relative;';
        container.appendChild(div2);

        engine.applyOverlay(div1, 'key1');
        engine.applyOverlay(div2, 'key2');
        TestSuite.assertNotNull(div1.querySelector('.shape-overlay-canvas'));
        TestSuite.assertNotNull(div2.querySelector('.shape-overlay-canvas'));

        engine.removeAllOverlays();
        TestSuite.assertTrue(div1.querySelector('.shape-overlay-canvas') === null);
        TestSuite.assertTrue(div2.querySelector('.shape-overlay-canvas') === null);
        document.body.removeChild(container);
    });

    TestSuite.test('disabling shapesEnabled removes all overlays', () => {
        const engine = new ShapeEngine({ shapesEnabled: true, animateShapes: false });
        const div = document.createElement('div');
        div.style.cssText = 'width:100px;height:100px;position:relative;';
        document.body.appendChild(div);
        engine.applyOverlay(div, 'disable-test');
        TestSuite.assertNotNull(div.querySelector('.shape-overlay-canvas'));

        engine.shapesEnabled = false;
        TestSuite.assertTrue(div.querySelector('.shape-overlay-canvas') === null);
        document.body.removeChild(div);
    });
});

TestSuite.group('ShapeEngine setMLModel', () => {
    TestSuite.test('accepts a model reference', () => {
        const engine = new ShapeEngine();
        const mockModel = { classify: () => {} };
        engine.setMLModel(mockModel);
        // No error means success - the model is stored internally
        TestSuite.assertTrue(true);
    });
});

TestSuite.group('ShapeEngine Performer Mode Behavior', () => {
    TestSuite.test('applyOverlay respects none mode by not creating overlays in applyToImages', async () => {
        const engine = new ShapeEngine({ shapesEnabled: true, performerMode: 'none', animateShapes: false });
        const grid = document.createElement('div');
        grid.innerHTML = `
            <div class="performer-card" data-username="user1">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
            <div class="performer-card" data-username="user2">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
        `;
        document.body.appendChild(grid);
        await engine.applyToImages(grid);
        const canvases = grid.querySelectorAll('.shape-overlay-canvas');
        TestSuite.assertEquals(0, canvases.length);
        engine.removeAllOverlays();
        document.body.removeChild(grid);
    });

    TestSuite.test('single mode limits to one overlay in applyToImages', async () => {
        const engine = new ShapeEngine({ shapesEnabled: true, performerMode: 'single', animateShapes: false });
        const grid = document.createElement('div');
        grid.innerHTML = `
            <div class="performer-card" data-username="user1">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
            <div class="performer-card" data-username="user2">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
        `;
        document.body.appendChild(grid);
        await engine.applyToImages(grid);
        const canvases = grid.querySelectorAll('.shape-overlay-canvas');
        TestSuite.assertEquals(1, canvases.length);
        engine.removeAllOverlays();
        document.body.removeChild(grid);
    });

    TestSuite.test('many mode applies to all cards in applyToImages', async () => {
        const engine = new ShapeEngine({ shapesEnabled: true, performerMode: 'many', animateShapes: false });
        const grid = document.createElement('div');
        grid.innerHTML = `
            <div class="performer-card" data-username="user1">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
            <div class="performer-card" data-username="user2">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
            <div class="performer-card" data-username="user3">
                <div class="card-image-container" style="width:100px;height:100px;position:relative;"></div>
            </div>
        `;
        document.body.appendChild(grid);
        await engine.applyToImages(grid);
        const canvases = grid.querySelectorAll('.shape-overlay-canvas');
        TestSuite.assertEquals(3, canvases.length);
        engine.removeAllOverlays();
        document.body.removeChild(grid);
    });
});

TestSuite.group('ShapeEngine applyToIframes', () => {
    TestSuite.test('applies overlays to visible iframe wrappers', async () => {
        const engine = new ShapeEngine({ shapesEnabled: true, performerMode: 'many', animateShapes: false });
        const grid = document.createElement('div');
        grid.innerHTML = `
            <div class="iframe-wrapper" data-slot="1" style="width:200px;height:150px;position:relative;">
                <iframe src="about:blank"></iframe>
            </div>
            <div class="iframe-wrapper" data-slot="2" style="width:200px;height:150px;position:relative;">
                <iframe src="about:blank"></iframe>
            </div>
            <div class="iframe-wrapper hidden" data-slot="3" style="width:200px;height:150px;position:relative;">
                <iframe src="about:blank"></iframe>
            </div>
        `;
        document.body.appendChild(grid);
        const viewerSlots = new Map();
        await engine.applyToIframes(grid, viewerSlots);
        const canvases = grid.querySelectorAll('.shape-overlay-canvas');
        TestSuite.assertEquals(2, canvases.length); // only visible (non-hidden) wrappers
        engine.removeAllOverlays();
        document.body.removeChild(grid);
    });

    TestSuite.test('single mode limits to one iframe overlay', async () => {
        const engine = new ShapeEngine({ shapesEnabled: true, performerMode: 'single', animateShapes: false });
        const grid = document.createElement('div');
        grid.innerHTML = `
            <div class="iframe-wrapper" data-slot="1" style="width:200px;height:150px;position:relative;">
                <iframe src="about:blank"></iframe>
            </div>
            <div class="iframe-wrapper" data-slot="2" style="width:200px;height:150px;position:relative;">
                <iframe src="about:blank"></iframe>
            </div>
        `;
        document.body.appendChild(grid);
        await engine.applyToIframes(grid, new Map());
        const canvases = grid.querySelectorAll('.shape-overlay-canvas');
        TestSuite.assertEquals(1, canvases.length);
        engine.removeAllOverlays();
        document.body.removeChild(grid);
    });
});

// Run all tests and output summary
const results = TestSuite.summarize();
if (typeof process !== 'undefined' && process.exit) {
    process.exit(results.failed > 0 ? 1 : 0);
}
