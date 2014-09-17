/**
 * This widget provides visibility and color data controls for a VisualizationModel.
 * It emits an event anytime the value has chaged, attaching data in the form
 * of a serialized query string.
 */
cinema.views.PipelineControlWidget = Backbone.View.extend({
    events: {
        'click .c-layer-visibility-toggle': function (e) {
            var link = $(e.currentTarget);

            if (link.attr('state') === 'on') {
                link.attr('state', 'off').find('i')
                    .removeClass('icon-eye')
                    .addClass('icon-eye-off c-icon-disabled');
            }
            else {
                link.attr('state', 'on').find('i')
                    .removeClass('icon-eye-off c-icon-disabled')
                    .addClass('icon-eye');
            }

            this.computeQuery();
        },

        'click .c-pipeline-visibility-toggle': function (e) {
            var link = $(e.currentTarget),
                state;

            if (link.attr('state') === 'on') {
                state = 'off';
                link.attr('state', state).find('i')
                    .removeClass('icon-eye')
                    .addClass('icon-eye-off c-icon-disabled');


            }
            else {
                state = 'on';
                link.attr('state', state).find('i')
                    .removeClass('icon-eye-off c-icon-disabled')
                    .addClass('icon-eye');
            }

            _.each(link.parent().find('.c-layer-visibility-toggle'), function (el) {
                $(el).attr('state', state);

                if (state === 'on') {
                    $(el).find('i').removeClass('icon-eye-off c-icon-disabled')
                                   .addClass('icon-eye');
                }
                else {
                    $(el).find('i').removeClass('icon-eye')
                                   .addClass('icon-eye-off c-icon-disabled');
                }
            });

            this.computeQuery();
        }
    },

    initialize: function (settings) {
        var defaultLayers = this.model.defaultLayers();
        this.layers = settings.layers || new cinema.models.LayerModel(defaultLayers);
        this.listenTo(this.model, 'change', this.render);
    },

    render: function () {
        var metadata = this.model.get('metadata');
        if (!metadata) {
            return;
        }
        this.$el.html(cinema.templates.pipelineControl({
            metadata: metadata
        }));

        var view = this;

        _.each(this.$('.c-directory-color-select'), function (el) {
            var theEl = $(el),
                directoryId = theEl.attr('directory-id'),
                layerId = theEl.attr('layer-id');
            theEl.popover('destroy').popover({
                html: true,
                container: 'body',
                placement: 'right',
                template: '<div class="popover" role="tooltip"><div class="arrow"></div><div class="popover-content c-color-by-popover"></div></div>',
                content: cinema.templates.directoryColorByChooser({
                    directoryId: directoryId,
                    layerId: layerId,
                    metadata: this.model.get('metadata')
                })
            }).off('show.bs.popover').on('show.bs.popover', function () {
                _.each(view.$('.c-directory-color-select'), function (otherEl) {
                    if ($(otherEl).attr('directory-id') !== directoryId) {
                        $(otherEl).popover('hide');
                    }
                });
                _.each(view.$('.c-layer-color-select'), function (otherEl) {
                    $(otherEl).popover('hide');
                });
            }).on('shown.bs.popover', function () {
                $('input[name=color-by-select][value=' + theEl.attr('color-field') + ']').attr('checked', 'checked');
                $('input[name=color-by-select]').change(function () {
                    theEl.attr('color-field', $(this).val());
                });
                _.each(view.$('.c-layer-color-select'), function (otherEl) {
                    if ($(otherEl).attr('directory-id') === directoryId) {
                        $('input[name=color-by-select][value=' + theEl.attr('color-field') + ']').attr('checked', 'checked');
                        $('input[name=color-by-select]').change(function () {
                            $(otherEl).attr('color-field', $(this).val());
                            view.computeQuery();
                        });
                    }
                });
            });
        }, this);

        _.each(this.$('.c-layer-color-select'), function (el) {
            var directoryId = $(el).attr('directory-id'),
                layerId = $(el).attr('layer-id');
            $(el).popover('destroy').popover({
                html: true,
                container: 'body',
                placement: 'right',
                template: '<div class="popover" role="tooltip"><div class="arrow"></div><div class="popover-content c-color-by-popover"></div></div>',
                content: cinema.templates.colorByChooser({
                    directoryId: directoryId,
                    layerId: layerId,
                    metadata: this.model.get('metadata')
                })
            }).off('show.bs.popover').on('show.bs.popover', function () {
                _.each(view.$('.c-layer-color-select'), function (otherEl) {
                    if ($(otherEl).attr('layer-id') !== layerId) {
                        $(otherEl).popover('hide');
                    }
                });
                _.each(view.$('.c-directory-color-select'), function (otherEl) {
                    $(otherEl).popover('hide');
                });
            }).on('shown.bs.popover', function () {
                $('input[name=color-by-select][value=' +
                    $(el).attr('color-field') + ']').attr('checked', 'checked');
                $('input[name=color-by-select]').change(function () {
                    $(el).attr('color-field', $(this).val());
                    view.computeQuery();
                });
                $('.c-popover-close').click(function () {
                    $(el).popover('hide');
                });
            });
        }, this);

        this.computeQuery();

        return this;
    },

    /**
     * Compute the new query string based on the current state of the widget.
     */
    computeQuery: function () {
        console.log("computeQuery");
        var q = '';
        _.each(this.$('.c-layer-visibility-toggle[state=on]'), function (el) {
            q += $(el).attr('layer-id');
            q += $(el).parent().find('.c-layer-color-select').attr('color-field') ||
                 $(el).attr('color-field');
        });

        this.layers.setFromString(q);
    }

});
