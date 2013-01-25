'use strict';

YUI.add('juju-topology-viewport', function(Y) {
  var views = Y.namespace('juju.views'),
      utils = Y.namespace('juju.views.utils'),
      models = Y.namespace('juju.models'),
      d3ns = Y.namespace('d3');

  /**
   * @module topology-viewport
   * @class ViewportModule
   * @namespace views
   **/
  views.ViewportModule = Y.Base.create('ViewportModule', d3ns.Module, [], {

    events: {
      yui: {
        windowresize: 'resized',
        rendered: 'resized'
      }
    },

    // for testing
    getContainer: function() {
      return this.get('container');
    },

    setAllTheDimentions: function(dimensions, canvas, svg, topo, zoomPlane) {
      // Get the canvas out of the way so we can calculate the size
      // correctly (the canvas contains the svg).  We want it to be the
      // smallest size we accept--no smaller or bigger--or else the
      // presence or absence of scrollbars may affect our calculations
      // incorrectly.  The real canvas size will be set in a moment.
      canvas.setStyles({height: '600px', width: '800px'});
      svg.setAttribute('width', dimensions.width);
      svg.setAttribute('height', dimensions.height);
      topo.vis.attr('width', dimensions.width);
      topo.vis.attr('height', dimensions.height);

      zoomPlane.setAttribute('width', dimensions.width);
      zoomPlane.setAttribute('height', dimensions.height);
      canvas.setStyles({
        width: dimensions.width + 'px',
        height: dimensions.height + 'px'});
      // Reset the scale parameters
      topo.set('size', [dimensions.width, dimensions.height]);
    },

    /*
     * Set the visualization size based on the viewport.
     *
     * This event allows other page components that may unintentionally affect
     * the page size, such as the charm panel, to get out of the way before we
     * compute sizes.  Note the "afterPageSizeRecalculation" event at the end
     * of this function.
     */
    resized: function() {
      var container = this.getContainer();
      var svg = container.one('svg');
      var canvas = container.one('.topology-canvas');
      // XXX Why?  Is this for testing?  Is there some race with the canvas
      // and/or "svg" becoming available?
      if (!Y.Lang.isValue(canvas) || !Y.Lang.isValue(svg)) {
        return;
      }
      var topo = this.get('component');
      var zoomPlane = container.one('.zoom-plane');
      topo.fire('beforePageSizeRecalculation');
      var dimensions = utils.getEffectiveViewportSize(true, 800, 600);
      this.setAllTheDimentions(dimensions, canvas, svg, topo, zoomPlane);
      topo.fire('afterPageSizeRecalculation');
    }

  }, {
    ATTRS: {}
  });
}, '0.1.0', {
  requires: [
    'd3',
    'd3-components',
    'node',
    'event',
    'juju-models',
    'juju-env'
  ]
});
