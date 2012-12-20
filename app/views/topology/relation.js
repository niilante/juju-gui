'use strict';

YUI.add('juju-topology-relation', function(Y) {
  var views = Y.namespace('juju.views'),
      models = Y.namespace('juju.models'),
      d3ns = Y.namespace('d3');

  /**
   * @module topology-relations
   * @class RelationModule
   * @namespace views
   **/
  var RelationModule = Y.Base.create('RelationModule', d3ns.Module, [], {

    events: {
      scene: {
        '.rel-label': {
          click: 'relationClick'
        },
        '.dragline': {
          /** The user clicked while the dragline was active. */
          click: {callback: function(d, self) {
            // It was technically the dragline that was clicked, but the
            // intent was to click on the background, so...
            self.backgroundClicked();
          }}
        },
        '.add-relation': {
          /** The user clicked on the "Build Relation" menu item. */
          click: {
            callback: function(data, context) {
              var box = context.get('active_service'),
                  service = context.serviceForBox(box),
                  origin = context.get('active_context');
              context.addRelationDragStart(box, context);
              context.service_click_actions
                .toggleControlPanel(box, context, origin);
              context.service_click_actions.addRelationStart(
                  box, context, origin);
            }}
        },
      },
      d3: {
        '.service': {
          'mousedown.addrel': {callback: function(d, context) {
            var evt = d3.event;
            context.longClickTimer = Y.later(750, this, function(d, e) {
              // Provide some leeway for accidental dragging.
              if ((Math.abs(d.x - d.oldX) + Math.abs(d.y - d.oldY)) /
                  2 > 5) {
                return;
              }

              // Sometimes mouseover is fired after the mousedown, so ensure
              // we have the correct event in d3.event for d3.mouse().
              d3.event = e;

              // Start the process of adding a relation
              context.addRelationDragStart(d, context);
            }, [d, evt], false);
          }},
          'mouseup.addrel': {callback: function(d, context) {
            // Cancel the long-click timer if it exists.
            if (context.longClickTimer) {
              context.longClickTimer.cancel();
            }
          }}
        }
      },
      yui: {
        serviceMoved: {callback: 'updateLinkEndpoints'},
        servicesRendered: {callback: 'updateLinks'},
        cancelRelationBuild: {callback: 'cancelRelationBuild'},
        addRelationDragStart: {callback: 'addRelationDragStart'},
        addRelationDrag: {callback: 'addRelationDrag'},
        addRelationDragEnd: {callback: 'addRelationDragEnd'}
      }
    },
      
    initializer: function(options) {
      RelationModule.superclass.constructor.apply(this, arguments);
      this.relPairs = [];
    },

    render: function() {
      RelationModule.superclass.render.apply(this, arguments);
      return this;
    },

    update: function() {
      RelationModule.superclass.update.apply(this, arguments);
      
      var db = this.get('component').get('db'),
          relations = db.relations.toArray();
      this.relPairs = this.processRelations(relations)

      return this;
    },

    processRelation: function(r) {
      var self = this,
              endpoints = r.get('endpoints'),
              rel_services = [];

      Y.each(endpoints, function(ep) {
        rel_services.push([ep[1].name, self.service_boxes[ep[0]]]);
      });
      return rel_services;
    },

    processRelations: function(rels) {
      var self = this,
              pairs = [];
      Y.each(rels, function(rel) {
        var pair = self.processRelation(rel);

        // skip peer for now
        if (pair.length === 2) {
          var bpair = views.BoxPair()
                                 .model(rel)
                                 .source(pair[0][1])
                                 .target(pair[1][1]);
          // Copy the relation type to the box.
          if (bpair.display_name === undefined) {
            bpair.display_name = pair[0][0];
          }
          pairs.push(bpair);
        }
      });
      return pairs;
    },

    /*
         * Utility function to get subordinate relations for a service.
         */
    subordinateRelationsForService: function(service) {
      return this.rel_pairs.filter(function(p) {
        return p.modelIds().indexOf(service.modelId()) !== -1 &&
            p.scope === 'container';
      });
    },

    function updateLinks() {
      // Enter.
      var g = this.drawRelationGroup(),
              link = g.selectAll('line.relation');

      // Update (+ enter selection).
      link.each(this.drawRelation);

      // Exit
      g.exit().remove();
    };

    /**
     * Update relation line endpoints for a given service.
     *
     * @method updateLinkEndpoints
     * @param {Object} service The service module that has been moved.
     */
    updateLinkEndpoints: function(service) {
      Y.each(Y.Array.filter(self.rel_pairs, function(relation) {
        return relation.source() === service ||
            relation.target() === service;
      }), function(relation) {
        var rel_group = d3.select('#' + relation.id),
                connectors = relation.source()
                  .getConnectorPair(relation.target()),
                s = connectors[0],
                t = connectors[1];
        rel_group.select('line')
              .attr('x1', s[0])
              .attr('y1', s[1])
              .attr('x2', t[0])
              .attr('y2', t[1]);
        rel_group.select('.rel-label')
              .attr('transform', function(d) {
              return 'translate(' +
                  [Math.max(s[0], t[0]) -
                       Math.abs((s[0] - t[0]) / 2),
                       Math.max(s[1], t[1]) -
                       Math.abs((s[1] - t[1]) / 2)] + ')';
            });
      });
    },

    drawRelationGroup: function() {
      // Add a labelgroup.
      var self = this,
          vis = this.get('component').vis,
          g = vis.selectAll('g.rel-group')
                 .data(self.rel_pairs, function(r) {
                   return r.modelIds();
                 });

      var enter = g.enter();

      enter.insert('g', 'g.service')
              .attr('id', function(d) {
            return d.id;
          })
              .attr('class', function(d) {
                // Mark the rel-group as a subordinate relation if need be.
                return (d.scope === 'container' ?
                    'subordinate-rel-group ' : '') +
                    'rel-group';
              })
              .append('svg:line', 'g.service')
              .attr('class', function(d) {
                // Style relation lines differently depending on status.
                return (d.pending ? 'pending-relation ' : '') +
                    (d.scope === 'container' ? 'subordinate-relation ' : '') +
                    'relation';
              });

      g.selectAll('.rel-label').remove();
      g.selectAll('text').remove();
      g.selectAll('rect').remove();
      var label = g.append('g')
              .attr('class', 'rel-label')
              .attr('transform', function(d) {
                // XXX: This has to happen on update, not enter
                var connectors = d.source().getConnectorPair(d.target()),
                    s = connectors[0],
                    t = connectors[1];
                return 'translate(' +
                    [Math.max(s[0], t[0]) -
                     Math.abs((s[0] - t[0]) / 2),
                     Math.max(s[1], t[1]) -
                     Math.abs((s[1] - t[1]) / 2)] + ')';
              });
      label.append('text')
              .append('tspan')
              .text(function(d) {return d.display_name; });
      label.insert('rect', 'text')
              .attr('width', function(d) {
            return d.display_name.length * 10 + 10;
          })
              .attr('height', 20)
              .attr('x', function() {
                return -parseInt(d3.select(this).attr('width'), 10) / 2;
              })
              .attr('y', -10)
              .attr('rx', 10)
              .attr('ry', 10);

      return g;
    },

    drawRelation: function(relation) {
      var connectors = relation.source()
                .getConnectorPair(relation.target()),
              s = connectors[0],
              t = connectors[1],
              link = d3.select(this);

      link
                .attr('x1', s[0])
                .attr('y1', s[1])
                .attr('x2', t[0])
                .attr('y2', t[1]);
      return link;
    },

    /*
         * Event handler for the add relation button.
         */
    addRelation: function(evt) {
      var curr_action = this.get('currentServiceClickAction'),
              container = this.get('container');
      if (curr_action === 'show_service') {
        this.set('currentServiceClickAction', 'addRelationStart');
      } else if (curr_action === 'addRelationStart' ||
              curr_action === 'ambiguousAddRelationCheck') {
        this.set('currentServiceClickAction', 'toggleControlPanel');
      } // Otherwise do nothing.
    },

    addRelationDragStart: function(d, context) {
      // Create a pending drag-line.
      var vis = this.get('component').vis,
          dragline = vis.append('line')
                        .attr('class',
                              'relation pending-relation dragline dragging'),
          self = this;

      // Start the line between the cursor and the nearest connector
      // point on the service.
      var mouse = d3.mouse(Y.one('.topology svg').getDOMNode());
      self.cursorBox = new views.BoundingBox();
      self.cursorBox.pos = {x: mouse[0], y: mouse[1], w: 0, h: 0};
      var point = self.cursorBox.getConnectorPair(d);
      dragline.attr('x1', point[0][0])
              .attr('y1', point[0][1])
              .attr('x2', point[1][0])
              .attr('y2', point[1][1]);
      self.dragline = dragline;

      // Start the add-relation process.
      context.service_click_actions
            .addRelationStart(d, self, context);
    },

    addRelationDrag: function(d, context) {
      // Rubberband our potential relation line if we're not currently
      // hovering over a potential drop-point.
      if (!this.get('potential_drop_point_service')) {
        // Create a BoundingBox for our cursor.
        this.cursorBox.pos = {x: d3.event.x, y: d3.event.y, w: 0, h: 0};

        // Draw the relation line from the connector point nearest the
        // cursor to the cursor itself.
        var connectors = this.cursorBox.getConnectorPair(d),
                s = connectors[1];
        this.dragline.attr('x1', s[0])
              .attr('y1', s[1])
              .attr('x2', d3.event.x)
              .attr('y2', d3.event.y);
      }
    },

    addRelationDragEnd: function() {
      // Get the line, the endpoint service, and the target <rect>.
      var self = this;
      var rect = self.get('potential_drop_point_rect');
      var endpoint = self.get('potential_drop_point_service');

      self.buildingRelation = false;
      self.cursorBox = null;

      // If we landed on a rect, add relation, otherwise, cancel.
      if (rect) {
        self.service_click_actions
            .ambiguousAddRelationCheck(endpoint, self, rect);
      } else {
        // TODO clean up, abstract
        self.cancelRelationBuild();
        self.addRelation(); // Will clear the state.
      }
    },
    removeRelation: function(d, context, view, confirmButton) {
      var env = this.get('component').get('env'),
              endpoints = d.endpoints,
              relationElement = Y.one(context.parentNode).one('.relation');
      utils.addSVGClass(relationElement, 'to-remove pending-relation');
      env.remove_relation(
          endpoints[0][0] + ':' + endpoints[0][1].name,
          endpoints[1][0] + ':' + endpoints[1][1].name,
          Y.bind(this._removeRelationCallback, this, view,
          relationElement, d.relation_id, confirmButton));
    },

    _removeRelationCallback: function(view,
            relationElement, relationId, confirmButton, ev) {
      var db = this.get('component').get('db'),
          service = this.get('model');
      if (ev.err) {
        db.notifications.add(
            new models.Notification({
              title: 'Error deleting relation',
              message: 'Relation ' + ev.endpoint_a + ' to ' + ev.endpoint_b,
              level: 'error'
            })
        );
        utils.removeSVGClass(this.relationElement,
            'to-remove pending-relation');
      } else {
        // Remove the relation from the DB.
        db.relations.remove(db.relations.getById(relationId));
        // Redraw the graph and reattach events.
        db.fire('update');
      }
      view.get('rmrelation_dialog').hide();
      view.get('rmrelation_dialog').destroy();
      confirmButton.set('disabled', false);
    },

    removeRelationConfirm: function(d, context, view) {
      // Destroy the dialog if it already exists to prevent cluttering
      // up the DOM.
      if (!Y.Lang.isUndefined(view.get('rmrelation_dialog'))) {
        view.get('rmrelation_dialog').destroy();
      }
      view.set('rmrelation_dialog', views.createModalPanel(
          'Are you sure you want to remove this relation? ' +
              'This cannot be undone.',
          '#rmrelation-modal-panel',
          'Remove Relation',
          Y.bind(function(ev) {
            ev.preventDefault();
            var confirmButton = ev.target;
            confirmButton.set('disabled', true);
            view.removeRelation(d, context, view, confirmButton);
          },
          this)));
    },

    cancelRelationBuild: function() {
      var vis = this.get('component').vis;
      if (this.dragline) {
        // Get rid of our drag line
        this.dragline.remove();
        this.dragline = null;
      }
      this.clickAddRelation = null;
      this.set('currentServiceClickAction', 'toggleControlPanel');
      this.buildingRelation = false;
      this.show(vis.selectAll('.service'))
                  .classed('selectable-service', false);
    },

    /**
     * An "add relation" action has been initiated by the user.
     *
     * @method startRelation
     * @param {object} service The service that is the source of the
     *  relation.
     * @return {undefined} Side effects only.
     */
    startRelation: function(service) {
      // Set flags on the view that indicate we are building a relation.
      var vis = this.get('component').vis;

      this.buildingRelation = true;
      this.clickAddRelation = true;

      this.show(vis.selectAll('.service'));

      var db = this.get('component').get('db'),
          getServiceEndpoints = this.get('component')
                                    .get('getServiceEndpoints'),
          endpoints = models.getEndpoints(
          service, getServiceEndpoints(), db),
          // Transform endpoints into a list of relatable services (to the
          // service).
          possible_relations = Y.Array.map(
              Y.Array.flatten(Y.Object.values(endpoints)),
              function(ep) {return ep.service;}),
              invalidRelationTargets = {};

      // Iterate services and invert the possibles list.
      db.services.each(function(s) {
        if (Y.Array.indexOf(possible_relations,
            s.get('id')) === -1) {
          invalidRelationTargets[s.get('id')] = true;
        }
      });

      // Fade elements to which we can't relate.
      // Rather than two loops this marks
      // all services as selectable and then
      // removes the invalid ones.
      this.fade(vis.selectAll('.service')
              .classed('selectable-service', true)
              .filter(function(d) {
                return (d.id in invalidRelationTargets &&
                          d.id !== service.id);
              }))
              .classed('selectable-service', false);

      // Store possible endpoints.
      this.set('addRelationStart_possibleEndpoints', endpoints);
      // Set click action.
      this.set('currentServiceClickAction', 'ambiguousAddRelationCheck');
    },

      /*
           * Fired when clicking the first service in the add relation
           * flow.
           */
      addRelationStart: function(m, view, context) {
        var service = view.serviceForBox(m);
        view.startRelation(service);
        // Store start service in attrs.
        view.set('addRelationStart_service', m);
      },

      /*
           * Test if the pending relation is ambiguous.  Display a menu if so,
           * create the relation if not.
           */
      ambiguousAddRelationCheck: function(m, view, context) {
        var endpoints = view.get(
            'addRelationStart_possibleEndpoints')[m.id],
            container = view.get('container'),
            topo = view.get('component');

        if (endpoints && endpoints.length === 1) {
          // Create a relation with the only available endpoint.
          var ep = endpoints[0],
                  endpoints_item = [
                    [ep[0].service, {
                      name: ep[0].name,
                      role: 'server' }],
                    [ep[1].service, {
                      name: ep[1].name,
                      role: 'client' }]];
          view.service_click_actions
                .addRelationEnd(endpoints_item, view, context);
          return;
        }

        // Sort the endpoints alphabetically by relation name.
        endpoints = endpoints.sort(function(a, b) {
          return a[0].name + a[1].name < b[0].name + b[1].name;
        });

        // Stop rubberbanding on mousemove.
        view.clickAddRelation = null;

        // Display menu with available endpoints.
        var menu = container.one('#ambiguous-relation-menu');
        if (menu.one('.menu')) {
          menu.one('.menu').remove(true);
        }

        menu.append(Templates
                .ambiguousRelationList({endpoints: endpoints}));

        // For each endpoint choice, bind an an event to 'click' to
        // add the specified relation.
        menu.all('li').on('click', function(evt) {
          if (evt.currentTarget.hasClass('cancel')) {
            return;
          }
          var el = evt.currentTarget,
                  endpoints_item = [
                    [el.getData('startservice'), {
                      name: el.getData('startname'),
                      role: 'server' }],
                    [el.getData('endservice'), {
                      name: el.getData('endname'),
                      role: 'client' }]];
          menu.removeClass('active');
          view.service_click_actions
                .addRelationEnd(endpoints_item, view, context);
        });

        // Add a cancel item.
        menu.one('.cancel').on('click', function(evt) {
          menu.removeClass('active');
          view.cancelRelationBuild();
        });

        // Display the menu at the service endpoint.
        var tr = topo.zoom.translate(),
                z = topo.zoom.scale();
        menu.setStyle('top', m.y * z + tr[1]);
        menu.setStyle('left', m.x * z + m.w * z + tr[0]);
        menu.addClass('active');
        view.set('active_service', m);
        view.set('active_context', context);
        view.updateServiceMenuLocation();
      },

      /*
       * Fired when clicking the second service is clicked in the
       * add relation flow.
       *
       * :param endpoints: array of two endpoints, each in the form
       *   ['service name', {
       *     name: 'endpoint type',
       *     role: 'client or server'
       *   }]
       */
      addRelationEnd: function(endpoints, view, context) {
        // Redisplay all services
        view.cancelRelationBuild();

        // Get the vis, and links, build the new relation.
        var vis = view.get('component').vis,
            env = view.get('component').get('env'),
            db = view.get('component').get('db'),
            source = view.get('addRelationStart_service'),
            relation_id = 'pending:' + endpoints[0][0] + endpoints[1][0];

        if (endpoints[0][0] === endpoints[1][0]) {
          view.set('currentServiceClickAction', 'toggleControlPanel');
          return;
        }

        // Create a pending relation in the database between the
        // two services.
        db.relations.create({
          relation_id: relation_id,
          display_name: 'pending',
          endpoints: endpoints,
          pending: true
        });

        // Firing the update event on the db will properly redraw the
        // graph and reattach events.
        //db.fire('update');
        view.get('component').bindAllD3Events();
        view.update();

        // Fire event to add relation in juju.
        // This needs to specify interface in the future.
        env.add_relation(
            endpoints[0][0] + ':' + endpoints[0][1].name,
            endpoints[1][0] + ':' + endpoints[1][1].name,
            Y.bind(this._addRelationCallback, this, view, relation_id)
        );
        view.set('currentServiceClickAction', 'toggleControlPanel');
      },

      _addRelationCallback: function(view, relation_id, ev) {
        var db = view.get('component').get('db');
        // Remove our pending relation from the DB, error or no.
        db.relations.remove(
            db.relations.getById(relation_id));
        if (ev.err) {
          db.notifications.add(
              new models.Notification({
                title: 'Error adding relation',
                message: 'Relation ' + ev.endpoint_a +
                    ' to ' + ev.endpoint_b,
                level: 'error'
              })
          );
        } else {
          // Create a relation in the database between the two services.
          var result = ev.result,
                  endpoints = Y.Array.map(result.endpoints, function(item) {
                    var id = Y.Object.keys(item)[0];
                    return [id, item[id]];
                  });
          db.relations.create({
            relation_id: ev.result.id,
            type: result['interface'],
            endpoints: endpoints,
            pending: false,
            scope: result.scope,
            // endpoints[1][1].name should be the same
            display_name: endpoints[0][1].name
          });
        }
        // Redraw the graph and reattach events.
        db.fire('update');
      },

    /**
     * Show subordinate relations for a service.
     *
     * @method showSubordinateRelations
     * @param {Object} subordinate The sub-rel-block g element in the form
     * of a DOM node.
     * @return {undefined} nothing.
     */
    showSubordinateRelations: function(subordinate) {
      this.keepSubRelationsVisible = true;
      utils.addSVGClass(Y.one(subordinate).one('.sub-rel-count'), 'active');
    },

    /**
     * Hide subordinate relations.
     *
     * @method hideSubordinateRelations
     * @return {undefined} nothing.
     */
    hideSubordinateRelations: function() {
      var container = this.get('container');
      utils.removeSVGClass('.subordinate-rel-group', 'active');
      this.keepSubRelationsVisible = false;
      utils.removeSVGClass(container.one('.sub-rel-count.active'),
          'active');
    },

    relationClick: function(d, self) {
      if (d.scope === 'container') {
        var subRelDialog = views.createModalPanel(
            'You may not remove a subordinate relation.',
            '#rmsubrelation-modal-panel');
        subRelDialog.addButton(
            { value: 'Cancel',
              section: Y.WidgetStdMod.FOOTER,
              /**
               * @method action Hides the dialog on click.
               * @param {object} e The click event.
               * @return {undefined} nothing.
               */
              action: function(e) {
                e.preventDefault();
                subRelDialog.hide();
                subRelDialog.destroy();
              },
              classNames: ['btn']
            });
        subRelDialog.get('boundingBox').all('.yui3-button')
                .removeClass('yui3-button');
      } else {
        self.removeRelationConfirm(d, this, self);
      }
    }

  }, {
    ATTRS: {}

  });
  views.RelationModule = RelationModule;
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
