define(["dojo/Evented", "dojo/_base/declare", "dojo/_base/lang", "dojo/has", "esri/kernel", 
    "dijit/_WidgetBase", "dijit/_TemplatedMixin", "dojo/on",
    "dojo/Deferred", "dojo/promise/all", 
    "dojo/query", 
    "esri/tasks/query", "esri/tasks/QueryTask",
    "dojo/text!application/dijit/templates/FeatureList.html", 
    "dojo/dom-class", "dojo/dom-attr", "dojo/dom-style", "dojo/dom-construct", "dojo/_base/event", 
    "dojo/string", 
    "dojo/text!application/dijit/templates/FeatureListTemplate.html",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/PictureMarkerSymbol", "esri/graphic",
    "esri/dijit/InfoWindow",
    "dojo/NodeList-dom", "dojo/NodeList-traverse"
    
    ], function (
        Evented, declare, lang, has, esriNS,
        _WidgetBase, _TemplatedMixin, on, 
        Deferred, all, 
        query,
        Query, QueryTask,
        FeatureList, 
        domClass, domAttr, domStyle, domConstruct, event, 
        string,
        listTemplate,
        SimpleMarkerSymbol, PictureMarkerSymbol, Graphic,
        InfoWindow
    ) {
    var Widget = declare("esri.dijit.FeatureList", [_WidgetBase, _TemplatedMixin, Evented], {
        // defaults
        templateString: FeatureList,

        options: {
            map: null,
            layers: null,
            visible: true
        },

        constructor: function (options, srcRefNode) {
            var defaults = lang.mixin({}, this.options, options);

            this.domNode = srcRefNode;
            // properties
            this.set("map", defaults.map);
            this.set("layers", defaults.layers);

            // this.markerSymbol = new SimpleMarkerSymbol({
                //   "color": [3,126,175,20],
                //   "size": 30,
                //   "xoffset": 0,
                //   "yoffset": 0,
                //   "type": "esriSMS",
                //   "style": "esriSMSCircle",
                //   "outline": {
                //     "color": [3,26,255,220],
                //     "width": 2,
                //     "type": "esriSLS",
                //     "style": "esriSLSSolid"
                //   }
                // });
            window.markerSymbol = new esri.symbol.PictureMarkerSymbol({
                "angle": 0,
                "xoffset": 0,
                "yoffset": 0,
                "type": "esriPMS",
                "url": require.toUrl("./images/ripple-dot1.gif"),
                "contentType": "image/gif",
                "width": 35,
                "height": 35
            });
            this.css = {
            };
        },

        startup: function () {
            if (!this.map) {
                this.destroy();
                console.log("FeaturesList::map required");
            }
            if (this.map.loaded) {
                this._init();
            } else {
                on.once(this.map, "load", lang.hitch(this, function () {
                    this._init();
                }));
            }
        },

        _init: function () {
            this._createList();
            this.set("loaded", true);
            this.emit("load", {});

            on(this.toolbar, 'updateTool', lang.hitch(this, function(name) {
                //console.log(name);
                if(name == "features") {
                    this._reloadList(this.map);
                }
            }));
        },

        FocusDetails: function() {
            if(!this._isVisible()) return;
            
            var details = this.domNode.querySelector('.showAttr');
            if(details) {
                var page = query(details).closest('.borderLi')[0];
                page.focus();
            }
        },

        _isVisible : function() {
            var page = query(this.domNode).closest('.page')[0];
            return dojo.hasClass(page, "showAttr");
        },

        _reloadList : function(ext) {
            if(!this._isVisible()) return;
            var loading_features = this.domNode.parentNode.querySelector('#loading_features');
            domStyle.set(loading_features, 'display', '-webkit-inline-box');
            var list = query("#featuresList")[0];
//             domStyle.set(list, 'display', 'none');
            this.map.graphics.clear();
            window.tasks.forEach(lang.hitch(this.map, function(t) {
                t.query.geometry = ext.extent;
                t.result = t.task.execute(t.query);
            }));
            promises = all(window.tasks.map(function(t) {return t.result;}));
            promises.then(
                function(results) {
                    list.innerHTML = "";
                    var preselected = null;
                    if(results) for(var i = 0; i<results.length; i++)
                    {
                        r = results[i];
                        var layer = window.tasks[i].layer;
                        //layer.clearSelection();
                        var content = '';
                        if(!layer.infoTemplate) {
                            var x = 1;
                        }
                        var fieldsMap = layer.infoTemplate._fieldsMap;
                        for(var p in layer.infoTemplate._fieldsMap) {
                            if(fieldsMap.hasOwnProperty(p) && fieldsMap[p].visible)
                            {
                                var pField = fieldsMap[p];
                                var fieldName = '${'+pField.fieldName+'}';
                                content+='<tr class="featureItem_${_featureId} hideAttr" tabindex="0">\n';
                                content+='    <td/>\n';
                                content+='    <td valign="top" align="right">'+pField.label+'</td>\n';
                                content+='    <td valign="top">:</td>\n';
                                content+='    <td valign="top">';
                                if(pField.format && pField.format.dateFormat) {
                                    content+='FORMAT_DATE('+fieldName+',"'+pField.format.dateFormat+'")';
                                }
                                else {
                                    content+=fieldName;
                                }
                                content+='</td>\n';
                                content+='</tr>\n';
                            }
                        }
                        for(var j = 0; j<r.features.length; j++) {
                            var f = r.features[j];
                            if(window._prevSelected == f.attributes[r.objectIdFieldName]) {
                                preselected = f;
                            }
                            if(f.attributes.Incident_Types && f.attributes.Incident_Types!=="") {
                                var featureListItem = this._getFeatureListItem(i, f, r.objectIdFieldName, layer, content, listTemplate);
                                if(featureListItem)
                                {
                                    domConstruct.create("li", {
                                        tabindex : 0,
                                        innerHTML : featureListItem
                                    }, list);
                                }
                            }
                        }
                    }
                    if(!preselected) {
                        window._prevSelected = null;
                    } else {
                        var checkbox = query("#featureButton_"+preselected.attributes[r.objectIdFieldName])[0];
                        checkbox.checked = true;
                        window.featureExpand(checkbox, true);
                    }
                    domStyle.set(loading_features, 'display', 'none');
//                     domStyle.set(list, 'display', '');
                }
            );
        },

        _createList: function(){
            window.tasks = [];
            for(var l = 0; l<this.layers.length; l++) {
                layer = this.layers[l];
                if(layer.url && !layer.layerObject._isSnapshot)
                {
                    var _query = new Query();
                    _query.outFields = ["*"];
                    _query.returnGeometry = false;
                    _query.spatialRelationship = "esriSpatialRelIntersects";
                    window.tasks.push({
                        layer : layer.layerObject,
                        task : new QueryTask(this.map._layers[layer.id].url),
                        query : _query
                    });
                }   
            }

            window.featurePanZoom = function(btn, panOnly) {
                values = btn.attributes.tag.value.split(',');
                var r = window.tasks[values[0]];
                var fid = values[1];
                var layer = r.layer;

                    q = new Query();
                    q.where = "[FID]='"+fid+"'";
                    q.outFields = ["FID"];
                    q.returnGeometry = true;
                    r.task.execute(q).then(function(ev) {
                        if(panOnly) {
                            layer._map.centerAt(ev.features[0].geometry);
                        } else {
                            layer._map.centerAndZoom(ev.features[0].geometry, 10);
                        }
                    });
            };

            window._prevSelected = null;                
            window.featureExpand = function(checkBox, restore) {
                if(_prevSelected && !restore) {
                    dojo.query('.featureItem_'+_prevSelected).forEach(function(e) {
                        dojo.removeClass(e, 'showAttr');
                        dojo.addClass(e, 'hideAttr');
                        query(e).closest('li').removeClass('borderLi');
                    });
                    dojo.query('#featureButton_'+_prevSelected).forEach(function(e) {
                        e.checked=false;
                    });
                }
                var values = checkBox.value.split(',');
                var r = window.tasks[values[0]];
                var fid = values[1];
                var layer = r.layer;
                layer._map.graphics.clear();

                if(checkBox.checked)
                {
                    _prevSelected = fid;
                    dojo.query('.featureItem_'+_prevSelected).forEach(function(e) {
                        dojo.addClass(e, 'showAttr');
                        dojo.removeClass(e, 'hideAttr');
                        query(e).closest('li').addClass('borderLi');
                    });

                    q = new Query();
                    q.where = "[FID]='"+fid+"'";
                    q.outFields = ["FID"];
                    q.returnGeometry = true;
                    r.task.execute(q).then(function(ev) {
                        //console.log(ev);
                        var graphic = new Graphic(ev.features[0].geometry, markerSymbol);
                        layer._map.graphics.add(graphic);
                    });
                    // layer.selectFeatures(q, FeatureLayer.SELECTION_NEW).then(function(f) {
                    //     f[0].symbol.size = 40;
                    // });
                } else {
                    dojo.query('.featureItem_'+_prevSelected).forEach(function(e) {
                        dojo.removeClass(e, 'showAttr');
                        dojo.addClass(e, 'hideAttr');
                    });                        
                    window._prevSelected = null;
                }
            };

            on(this.map, "extent-change", lang.hitch(this, this._reloadList), this);

            _getFeatureListItem = function(r, f, objectIdFieldName, layer, content, listTemplate) {
                try {
                    var featureId = f.attributes[objectIdFieldName];
                    var attributes = {_featureId:featureId, _layerId:r, _title:layer.infoTemplate.title(f), _content:content};
                    lang.mixin(attributes, f.attributes);
                    content = string.substitute(content, attributes);
                    listTemplate=string.substitute(listTemplate, attributes);
                    var result =  string.substitute(listTemplate, attributes);
                    var re = /FORMAT_(DATE|NUM)\((\d+),\"(.+)\"\)/gm;
                    do {
                        var matches = re.exec(result);
                        if(!matches) break;
                        if(matches[1]==="DATE") {
                            var date = new Date(Number(matches[2]));
                            result = result.replace(re, date.toLocaleDateString("en-US", {
                                year: "numeric", month: "long", day: "numeric"
                            }));
                        }
                    } while (true);
                    return result;
                } catch (e) {
                    console.log("Error on feature ("+featureId+")\n\t "+layer.infoTemplate.title(f)+"\n\t",e);
                    return null;
                }
            };
        },
    });
    if (has("extend-esri")) {
        lang.setObject("dijit.FeaturesList", Widget, esriNS);
    }
    return Widget;
});

