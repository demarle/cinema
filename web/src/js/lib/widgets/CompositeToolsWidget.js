/**
 * This widget provides visibility and color data controls for a VisualizationModel.
 * It emits an event anytime the value has changed, attaching data in the form
 * of a serialized query string.
 */
cinema.views.CompositeToolsWidget = Backbone.View.extend({
    initialize: function (settings) {
        this.model = settings.model;
        this.fields = settings.fields || new cinema.models.FieldModel({ info: this.model });
        this.viewpoint = settings.viewpoint || new cinema.models.ViewPointModel({ fields: this.fields });
        this.layers = settings.layers || new cinema.models.LayerModel(this.model.defaultLayers());
        this.toolbarSelector = settings.toolbarContainer || '.c-panel-toolbar';

        this.$('.c-control-panel-body').html(cinema.templates.compositeToolsWidget());

        this.listenTo(cinema.events, 'c:editpipelines', this.hidePipelineEditor);
        this.listenTo(cinema.events, 'c:editcontrols', this.hideControlEditor);

        this.pipeline = new cinema.views.PipelineWidget({
            el: this.$('.c-pipeline-content'),
            model: this.model,
            layers: this.layers
        });

        this.controls = new cinema.views.FieldsControlWidget({
            el: this.$('.c-control-content'),
            model: this.model,
            viewport: this.viewpoint,
            fields: this.fields,
            toolbarSelector: this.toolbarSelector,
            toolbarRootView: this,
            exclude: ['layer', 'field', 'filename']
        });
        this.render();
    },

    render: function () {
        this.$('.c-control-panel-body').html(cinema.templates.compositeToolsWidget());
        this.pipeline.setElement(this.$('.c-pipeline-content')).render();
        this.controls.setElement(this.$('.c-control-content')).render();
    },

    hidePipelineEditor: function () {
        var link = this.$('.c-pipeline-edit'),
            state;
        if (link.attr('state') === 'on') {
            state = 'off';
            link.attr('state', state);
            link.fadeOut();
        }
        else {
            state = 'on';
            link.attr('state', state);
            link.fadeIn();
        }
    },

    hideControlEditor: function () {
        var link = this.$('.c-control-edit'),
            state;
        if (link.attr('state') === 'on') {
            state = 'off';
            link.attr('state', state);
            link.fadeOut();
        }
        else {
            state = 'on';
            link.attr('state', state);
            link.fadeIn();
        }
    },

});