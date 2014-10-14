(function () {
    // Create Chart data type view assembly

    cinema.viewFactory.registerView('parametric-chart-stack', 'view', function (rootSelector, viewType, model) {
        var container = $(rootSelector),
            fakeToolbarRootView = {
                update: function(root) {
                    this.$el = $('.c-view-panel', root);
                },
                '$el': $('.c-view-panel', container)
            },
            dataType = model.getDataType(),
            controlModel = new cinema.models.ControlModel({ info: model }),
            viewpointModel = new cinema.models.ViewPointModel({ controlModel: controlModel }),
            renderer = new cinema.views.ChartVisualizationCanvasWidget({
                el: $('.c-body-container', container),
                model: model,
                controlModel: controlModel,
                viewpoint: viewpointModel
            }),

            chartTools = new cinema.views.ChartToolsWidget({
                el: $('.c-tools-panel', container),
                model: model,
                controlModel: controlModel,
                viewport: renderer,
                toolbarSelector: '.c-panel-toolbar',
                toolbarRootView: fakeToolbarRootView
            }),
            controlList = [
                { position: 'right', key: 'tools', icon: 'icon-tools', title: 'Tools' }
            ];

        function render () {
            var root = $(rootSelector);
            fakeToolbarRootView.update(root);
            renderer.setElement($('.c-body-container', root)).render();
            chartTools.setElement($('.c-tools-panel', root)).render();
            refreshCamera(true);
        }

        function refreshCamera () {
            renderer.showViewpoint();
        }

        function resetCamera () {
            renderer.resetCamera();
        }

        controlModel.on('change', refreshCamera);
        viewpointModel.on('change', refreshCamera);
        cinema.events.on('c:resetCamera', resetCamera);

        render();

        return {
            controlList: controlList,
            render: render
        };
    });
}());