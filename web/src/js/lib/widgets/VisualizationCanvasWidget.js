/**
 * This widget renders the visualization defined by a VisualizationModel onto
 * a canvas element that will fill the parent element.
 */
cinema.views.VisualizationCanvasWidget = Backbone.View.extend({
    // Expose primitive events from the canvas for building interactors
    events: {
        'click .c-vis-render-canvas': function (e) {
            this.trigger('c:click', e);
        },
        'dblclick .c-vis-render-canvas': function (e) {
            this.trigger('c:dblclick', e);
        },
        'mousedown .c-vis-render-canvas': function (e) {
            this.trigger('c:mousedown', e);
        },
        'mousemove .c-vis-render-canvas': function (e) {
            this.trigger('c:mousemove', e);
        },
        'mouseup .c-vis-render-canvas': function (e) {
            this.trigger('c:mouseup', e);
        },
        'mousewheel .c-vis-render-canvas': function (e) {
            this.trigger('c:mousewheel', e);
        },
        'DOMMouseScroll .c-vis-render-canvas': function (e) {
            this.trigger('c:mousewheel', e);
        },
        'keypress .c-vis-render-canvas': function (e) {
            this.trigger('c:keypress', e);
        },
        'contextmenu .c-vis-render-canvas': function (e) {
            e.preventDefault();
        }
    },

    //subclass uses to extend
    _privateInit: function() {
    },

    initialize: function (settings) {
        var args = this.model.get('arguments');
        this.camera = settings.camera;

        if (!this.model.loaded()) {
            this.listenToOnce(this.model, 'change', function () {
                this.initialize(settings);
            });
            return;
        }

        this._privateInit();
        this.layers = settings.layers || new cinema.models.LayerModel(this.model.defaultLayers());
        this.backgroundColor = settings.backgroundColor || '#ffffff';
        this.orderMapping = {};
        this.compositeCache = {};
        this._viewpoint = {};

        this.compositeManager = new cinema.utilities.CompositeImageManager({
            visModel: this.model
        });

        this._computeLayerOffset();
        this._first = true;

        this.listenTo(this.compositeManager, 'c:error', function (e) {
            this.trigger('c:error', e);
        });
        this.listenTo(this.compositeManager, 'c:data.ready', function (data) {
            this._writeCompositeBuffer(data);

            if (this._first) {
                this._first = false;
                this.resetCamera();
            }

            this.drawImage();
        });
        this.listenTo(this.camera, 'change', this.drawImage);
        this.listenTo(this.layers, 'change', this.updateQuery);
    },

    render: function () {
        this.$el.html(cinema.templates.visCanvas());

        return this;
    },

    _computeOffset: function (order) {
        for (var i = 0; i < order.length; i += 1) {
            var offset = this.layerOffset[order[i]];
            if (offset > -1) {
                return offset;
            }
        }
        return -1;
    },

    _computeLayerOffset: function () {
        var query;

        this.layerOffset = {};

        query = this.layers.serialize();
        for (var i = 0; i < query.length; i += 2) {
            var layer = query[i];

            if (query[i + 1] === '_') {
                this.layerOffset[layer] = -1;
            } else {
                this.layerOffset[layer] = this.model.numberOfLayers() - 1 -
                    this.model.get('metadata').offset[query.substr(i, 2)];
            }
        }
    },

    _computeCompositeInfo: function (data) {
        var composite = data.json['pixel-order'].split('+'),
            count = composite.length;
        /*jshint -W016 */
        while (count--) {
            var str = composite[count];
            if (str[0] === '@') {
                composite[count] = Number(str.substr(1));
            } else if (!_.has(this.orderMapping, str)) {
                this.orderMapping[str] = this._computeOffset(str);
            }
        }

        this.compositeCache[data.key] = composite;
    },

    /**
     * Computes the composite image and writes it into the composite buffer.
     * @param data The payload from the composite image manager c:data.ready
     * callback. This will write computed composite data back into that
     * cache entry so it won't have to recompute it.
     */
    _writeCompositeBuffer: function (data) {
        if (!_.has(this.compositeCache, data.key)) {
            this._computeCompositeInfo(data);
        }

        var renderCanvas = this.$('.c-vis-render-canvas')[0],
            compositeCanvas = this.$('.c-vis-composite-buffer')[0],
            spriteCanvas = this.$('.c-vis-spritesheet-buffer')[0],
            dim = this.model.imageDimensions(),
            spritesheetDim = this.model.spritesheetDimensions(),
            spriteCtx = spriteCanvas.getContext('2d'),
            compositeCtx = compositeCanvas.getContext('2d'),
            composite = this.compositeCache[data.key];

        $(spriteCanvas).attr({
            width: spritesheetDim[0],
            height: spritesheetDim[1]
        });
        $(compositeCanvas).attr({
            width: dim[0],
            height: dim[1]
        });

        // Fill full spritesheet buffer with raw image data
        spriteCtx.drawImage(data.image, 0, 0);

        var pixelBuffer = spriteCtx.getImageData(0, 0,
                  spritesheetDim[0], spritesheetDim[1]).data,
            frontBuffer,
            pixelIdx = 0;

        // Fill the background if backgroundColor is specified
        if (this.backgroundColor) {
            compositeCtx.fillStyle = this.backgroundColor;
            compositeCtx.fillRect(0, 0, dim[0], dim[1]);
            frontBuffer = compositeCtx.getImageData(0, 0, dim[0], dim[1]);
        } else { // Otherwise use the bottom spritesheet image as a background
            frontBuffer = spriteCtx.getImageData(
                0, (this.model.numberOfLayers() - 1) * dim[1], dim[0], dim[1]);
        }

        var frontPixels = frontBuffer.data;

        for (var i = 0; i < composite.length; i += 1) {
            var order = composite[i];
            if (order > 0) {
                pixelIdx += order;
            } else {
                var offset = this.orderMapping[order];

                if (offset > -1) {
                    var localIdx = 4 * pixelIdx;
                    offset *= dim[0] * dim[1] * 4;
                    offset += localIdx;
                    frontPixels[localIdx] = pixelBuffer[offset];
                    frontPixels[localIdx + 1] = pixelBuffer[offset + 1];
                    frontPixels[localIdx + 2] = pixelBuffer[offset + 2];
                    frontPixels[localIdx + 3] = 255;
                }
                pixelIdx += 1;
            }
        }

        // Draw buffer to composite canvas
        compositeCtx.putImageData(frontBuffer, 0, 0);
    },

    /**
     * Call this after data has been successfully rendered onto the composite
     * canvas, and it will draw it with the correct scale, zoom, and center
     * onto the render canvas.
     */
    drawImage: function () {
        var renderCanvas = this.$('.c-vis-render-canvas')[0],
            compositeCanvas = this.$('.c-vis-composite-buffer')[0],
            w = this.$el.parent().width(),
            h = this.$el.parent().height(),
            iw = compositeCanvas.width,
            ih = compositeCanvas.height;

        $(renderCanvas).attr({
            width: w,
            height: h
        });
        renderCanvas.getContext('2d').clearRect(0, 0, w, h);

        var zoomLevel = this.camera.get('zoom'),
            drawingCenter = this.camera.get('center');

        var tw = Math.floor(iw * zoomLevel),
            th = Math.floor(ih * zoomLevel);

        var tx = drawingCenter[0] - (tw / 2),
            ty = drawingCenter[1] - (th / 2);

        renderCanvas.getContext('2d').drawImage(
            compositeCanvas,
            0,   0, iw, ih,  // Source image   [Location,Size]
            tx, ty, tw, th); // Target drawing [Location,Size]
    },

    /**
     * Reset the zoom level and drawing center such that the image is
     * centered and zoomed to fit within the parent container.
     */
    resetCamera: function () {
        var w = this.$el.parent().width(),
            h = this.$el.parent().height(),
            iw = this.$('.c-vis-composite-buffer').width(),
            ih = this.$('.c-vis-composite-buffer').height();

        this.camera.set({
            zoom: Math.min(w / iw, h / ih),
            center: [w / 2, h / 2]
        });
        return this;
    },

    /**
     * Change the viewpoint to show a different image.
     * @param viewpoint An object containing "time", "phi", and "theta" keys. If you
     * do not pass this, simply renders the current this.viewpoint value.
     * @return this, for chainability
     */
    showViewpoint: function () {
        var changed = true,
            viewpoint = {
                phi: this.camera.phi(),
                theta: this.camera.theta(),
                time: this.camera.time()
            };
        if (this._viewpoint.phi === viewpoint.phi &&
            this._viewpoint.theta === viewpoint.theta &&
            this._viewpoint.time === viewpoint.time) {
            changed = false;
        }
        this._viewpoint = viewpoint;
        if (changed) {
            this.compositeManager.updateViewpoint(this._viewpoint);
        } else {
            this.drawImage();
        }
        return this;
    },

    updateQuery: function (query) {
        this.orderMapping = {};
        this.compositeCache = {};
        this._computeLayerOffset();
        this._viewpoint = {}; // force redraw
        this.showViewpoint();
    },

    /**
     * Maps an [x, y] value relative to the canvas element to an [x, y] value
     * relative to the image being rendered on the canvas.
     * @param coords 2-length list representing [x, y] offset into the canvas
     * element.
     * @returns the corresponding [x, y] value of the image being rendered on
     * the canvas, respecting zoom level and drawing center, or null if the
     * input coordinates are on a part of the canvas outside of the image render
     * bounds. If not null, this will be a value bounded in each dimension by
     * the length of the composited image in that dimension.
     */
    mapToImageCoordinates: function (coords) {
        // TODO
    }
});
