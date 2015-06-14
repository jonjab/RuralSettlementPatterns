/*
 | Copyright 2014 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
	"dojo/ready",
	"dojo/_base/array",
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/Deferred",
	"dojo/dom",
	"dojo/dom-class",
	"dojo/dom-geometry",
	"dojo/dom-style",
	"dojo/json",
	"dojo/number",
	"dojo/on",
	"dojo/parser",
	"dojo/promise/all",
	"dojo/query",
	"dijit/layout/BorderContainer",
	"dijit/layout/ContentPane",
	"dijit/registry",
	"esri/arcgis/utils",
	"esri/dijit/Geocoder",
	"esri/geometry/Point",
	"esri/symbols/SimpleMarkerSymbol",
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleLineSymbol",
	"esri/graphic",
	"esri/geometry/Polygon",
	"esri/geometry/Circle",
	"esri/Color",
	"esri/renderers/SimpleRenderer",
	"esri/SpatialReference",
	"esri/layers/ArcGISImageServiceLayer",
	"esri/layers/FeatureLayer",
	"esri/layers/ImageServiceParameters",
	"esri/layers/MosaicRule",
	"esri/map",
	"esri/tasks/query",
	"esri/tasks/QueryTask",
	"esri/urlUtils",
	"esri/layers/GraphicsLayer",
	"application/uiUtils",
	"application/gridUtils",
	"application/timelineLegendUtils",
	"application/sharingUtils",
	"application/mapUtils",
	"application/timelineUtils"
], function (ready, array, declare, lang, Deferred, dom, domClass, domGeom, domStyle, json, number, on, parser, all, query, BorderContainer, ContentPane, registry, arcgisUtils, Geocoder, Point, SimpleMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, Graphic, Polygon, Circle, Color,  SimpleRenderer,SpatialReference, ArcGISImageServiceLayer, FeatureLayer,ImageServiceParameters, MosaicRule, Map, Query, QueryTask, urlUtils, GraphicsLayer, UserInterfaceUtils, GridUtils, TimelineLegendUtils, SharingUtils, MappingUtils, TimelineUtils) {
	
	return declare(null, {

		config:{},

		// user interface utils
		userInterfaceUtils:{},
		// dgrid utils
		gridUtils:{},
		// timeline utils
		timelineUtils:{},
		// timeline legend utils
		timelineLegendUtils:{},
		// sharing utils
		sharingUtils:{},
		// map utils
		mapUtils:{},

		/**
		 *
		 * @param config
		 */
		startup:function (config) {
			// config will contain application and user defined info for the template such as i18n strings, the web map id
			// and application id
			// any url parameters and any application specific configuration information.
			if (config) {
				this.config = config;
				// document ready
				ready(lang.hitch(this, function () {

					this.userInterfaceUtils = new UserInterfaceUtils(this, this.config);
					this.gridUtils = new GridUtils(this, this.config);
					this.timelineLegendUtils = new TimelineLegendUtils(this.config);
					this.timelineUtils = new TimelineUtils(this, this.config);
					this.sharingUtils = new SharingUtils(this.config);
					this.mapUtils = new MappingUtils(this.config);

					//supply either the webmap id or, if available, the item info
					var itemInfo = this.config.itemInfo || this.config.webmap;
					this._createWebMap(itemInfo);

					this.userInterfaceUtils.loadAppStyles();

					array.forEach(this.config.TIMELINE_LEGEND_VALUES, lang.hitch(this, this.timelineLegendUtils.buildLegend));

					this.userInterfaceUtils.watchSplitters(registry.byId("main-window"));
				}));
			} else {
				var error = new Error("Main:: Config is not defined");
				this.reportError(error);
			}
		},

		/**
		 *
		 * @param error
		 */
		reportError:function (error) {
			// remove loading class from body
			domClass.remove(document.body, "app-loading");
			domClass.add(document.body, "app-error");
			// an error occurred - notify the user. In this example we pull the string from the
			// resource.js file located in the nls folder because we've set the application up
			// for localization. If you don't need to support multiple languages you can hardcode the
			// strings here and comment out the call in index.html to get the localization strings.
			// set message
			var node = dom.byId("loading_message");
			if (node) {
				if (this.config && this.config.i18n) {
					node.innerHTML = this.config.i18n.map.error + ": " + error.message;
				} else {
					node.innerHTML = "Unable to create map: " + error.message;
				}
			}
		},

		// create a map based on the input web map id
		_createWebMap:function (itemInfo) {
			var lat, lng, lod;

			if (this.sharingUtils.urlQueryObject) {
				lat = this.sharingUtils.urlQueryObject.lat;
				lng = this.sharingUtils.urlQueryObject.lng;
				lod = this.sharingUtils.urlQueryObject.zl;
			} else {
				lat = this.config.BASEMAP_INIT_LAT;
				lng = this.config.BASEMAP_INIT_LNG;
				lod = this.config.BASEMAP_INIT_ZOOM;
			}

			arcgisUtils.createMap(itemInfo, "mapDiv", {
				mapOptions:{
					// Optionally define additional map config here for example you can
					// turn the slider off, display info windows, disable wraparound 180, slider position and more.
					center:[lng, lat],
					zoom:lod
				},
				bingMapsKey:this.config.bingKey
			}).then(lang.hitch(this, function (response) {
				// Once the map is created we get access to the response which provides important info
				// such as the map, operational layers, popup info and more. This object will also contain
				// any custom options you defined for the template. In this example that is the 'theme' property.
				// Here' we'll use it to update the application to match the specified color theme.
				// console.log(this.config);
				this.map = response.map;
				
				//This is where our Rural Culture feature service is being drawn - Ben
				var RuralURL = "https://services1.arcgis.com/4TXrdeWh0RyCqPgB/ArcGIS/rest/services/shapes/FeatureServer/0";
				var Rural = new FeatureLayer(RuralURL,{outFields:["*"], mode:FeatureLayer.MODE_SELECTION});
				this.map.addLayer(Rural);
				
				var topoUrl = "http://services.arcgis.com/YkVYBaX0zm7bsV3k/ArcGIS/rest/services/USGSTopoIndex/FeatureServer/0";
				var topos = new FeatureLayer(topoUrl, {outFields:["*"]});
				
				
				var fieldSelectionSymbol =
          			new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL,
            		new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
          		new Color([255, 173, 51,0.5]), 2));
		 	    Rural.setSelectionSymbol(fieldSelectionSymbol);
				 
				 
				 
				
				var allQuads = ["Burke, Vermont","Houlton, Maine","Mount Cube, New Hampshire","Mt. Holyoke, Massachusetts","Wareham, Massachusetts","Eastport, New York","Monson, Massachusetts","Adelphia, New Jersey","Ambler, Pennsylvania",	"Amsterdam, New York","Berkey, Ohio","Clarkston, Michigan","Franklin, Ohio","Lagro, Indiana","Angola West, Indiana" , "Benton Harbor, Michigan" , "Harvard, Illinois","Chester, Illinois","Guilford, Indiana","Iona, Indiana","Columbia, Missouri", "Grantville, Kansas", "Mahomet, Illinois", "Norton, Kansas", "Swede Creek, Kansas",	"Litchfield SW, Nebraska" ,"Ogden, Iowa" , "St. Charles, Iowa", "Alma, Wisconsin", "Annandale, Minnesota", "Central Lakes, Minnesota", "Mankato E, Minnesota", "Ambrose, North Dakota" ,"Newell, South Dakota", "Okaton SW, South Dakota","Scott City, Kansas", "Sparks, Nebraska", "Barclay, Maryland","Leonardtown, Maryland", "Mount Airy, Maryland", "Paw Paw, Maryland","Centre Hall, Pennsylvania","Springville, Pennsylvania","Canfield, Ohio", "Duncans Flat, Tennessee" , "London SW, Kentucky", "Brayton, Tennessee" ," Pressmens Home, Tennessee","Campbell Mountain, Georgia","Ironton, Missouri","Paris E, Kentucky", "Keefeton, Oklahoma","Linn, Missouri","Mount Judea, Arkansas", "Elliston, Virginia","Clemson, South Carolina","Hillsboro, Alabama", "Shelby, North Carolina","Tensaw, Alabama", "Natchez, Mississippi", "Pace, Mississippi", "Acworth, Texas" , "Lufkin, Texas","Pollock, Louisiana", "Big Spring N, Texas","China Grove, Texas", "Bartow, Florida" , "Limerick, Georgia",	"Crestview, Florida","Delmar Farms, Florida", "Edna, Texas","Napoleonville, Louisiana","Dexter West, New Mexico","Hueco Tanks, Texas", "Las Cruces, New Mexico","Cashion, Arizona", "Silver Reef Mountains, Arizona", "Kirtland, New Mexico", "Thompson Lakes, Montana", "Vaughn, Montana","Mission, Montana", "Niwot, Colorado", "Northgate, Colorado", "Paradox, Colorado", "Avon NW, Utah","Blair Basin, Utah", "Nephi, Utah","Guasti and vicinity, California", "Iris, California","Sawtooth Range, California", "Carpinteria, California","La Verne, California", "Liberty Farms, California", "Reedley, California", "Coos Bay, Oregon", "Endicott, Washington","Payette, Idaho", "Plantation, California", "Grandview, Washington","Lynden, Washington"];
				
				
				
				Rural.on("selection-complete", regionName);
				
				 
				 
				var txt = "<div align = center style='color:white'>Click anywhere within the US to see a Cultural Region</div>";
				document.getElementById("info").innerHTML = txt;
				
				 
				 function regionName(evt){ //point query to specific row in the Rural Culture feature layer
					 var selection = "";
					 var id ="";
					 
					 array.forEach(evt.features, function(feature){ //hopefully nobody reads this in the future
						 selection += feature.attributes.Region;    //if so, refer to TOC_final.xlsx on the S drive, under topo index scans/WebApp_hack; 'ids' are in order as they appear on the spreadhseet
						 id+= feature.attributes.ID;
						 if(id == "1"){ //New England Upland
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5600158","http://ims.er.usgs.gov/gda_services/download?item_id=5536591","http://ims.er.usgs.gov/gda_services/download?item_id=5582580"];
						 	var hyper = "<a href="+links[0]+">"+allQuads[0]+"</a><br><a href="+links[1]+">"+allQuads[1]+"</a><br><a href="+links[2]+">"+allQuads[2]+"</a>";
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							document.getElementById("info").innerHTML = txt;
							document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "2") { //Eastern Metro
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5633109","http://ims.er.usgs.gov/gda_services/download?item_id=5634975","http://ims.er.usgs.gov/gda_services/download?item_id=5445464","http://ims.er.usgs.gov/gda_services/download?item_id=5634499",		                                         "http://ims.er.usgs.gov/gda_services/download?item_id=5375324","http://ims.er.usgs.gov/gda_services/download?item_id=5321754"];
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[3]+"</a><br><a href="+links[1]+">"+allQuads[4]+"</a><br><a href="+links[2]+">"+allQuads[5]+"</a><br><a href="+links[3]+">"+allQuads[6]+"</a><br><a href="+links[4]+">"+allQuads[7]+"</a><br><a href="+links[5]	+">"+allQuads[8]+"</a></div>";
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
							 
						 };
						 if(id == "3") { //Erie Canal Lakeshore
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5450407","http://ims.er.usgs.gov/gda_services/download?item_id=5315198","http://ims.er.usgs.gov/gda_services/download?item_id=5438502"];
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[9]+"</a><br><a href="+links[1]+">"+allQuads[10]+"</a><br><a href="+links[2]+">"+allQuads[11]+"</a></div>"
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
							 
							 
						 };
						 if(id == "4") { //Buckeye
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5316562","http://ims.er.usgs.gov/gda_services/download?item_id=5286528","http://ims.er.usgs.gov/gda_services/download?item_id=5676854"];
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[12]+"</a><br><a href="+links[1]+">"+allQuads[13]+"</a><br><a href="+links[2]+">"+allQuads[14]+"</a></div>";
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "5") { //Lake Shore Metro
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5679517","http://ims.er.usgs.gov/gda_services/download?item_id=5531817"]
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[15]+"</a><br><a href="+links[1]+">"+allQuads[16]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "6") { //Free Soilers
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5531445","http://ims.er.usgs.gov/gda_services/download?item_id=5285930","http://ims.er.usgs.gov/gda_services/download?item_id=5286232","http://ims.er.usgs.gov/gda_services/download?item_id=5577038",												"http://ims.er.usgs.gov/gda_services/download?item_id=5274140","http://ims.er.usgs.gov/gda_services/download?item_id=5277182","http://ims.er.usgs.gov/gda_services/download?item_id=5273090"];
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[17]+"</a><br><a href="+links[1]+">"+allQuads[18]+"</a><br><a href="+links[2]+">"+allQuads[19]+"</a><br><a href="+links[3]+">"+allQuads[20]+"</a><br><a href="+links[4]+">"+allQuads[21]+"</a><br><a href="+links[5]	+">"+allQuads[23]+"</a><br><a href="+links[6]+">"+allQuads[24]+"</a></div>";
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "7") { //Corn Belt
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5532047","http://ims.er.usgs.gov/gda_services/download?item_id=5561611","http://ims.er.usgs.gov/gda_services/download?item_id=5283515","http://ims.er.usgs.gov/gda_services/download?item_id=5283587"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[22]+"</a><br><a href="+links[1]+">"+allQuads[25]+"</a><br><a href="+links[2]+">"+allQuads[26]+"</a><br><a href="+links[3]+">"+allQuads[27]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "8") { //Scandanavian American
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5308422","http://ims.er.usgs.gov/gda_services/download?item_id=5344842","http://ims.er.usgs.gov/gda_services/download?item_id=5345214"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[28]+"</a><br><a href="+links[1]+">"+allQuads[29]+"</a><br><a href="+links[2]+">"+allQuads[31]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "9") { //Lake States Cut Over
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5340072"];
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[30]+"</a></div>";
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "10") { //Northeastern Homestead
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5473863"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[32]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "11") { //Northwestern Homestead
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5607234","http://ims.er.usgs.gov/gda_services/download?item_id=5607290"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[33]+"</a><br><a href="+links[1]+">"+allQuads[34]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "12") { //Southern HomeStead
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5277214","http://ims.er.usgs.gov/gda_services/download?item_id=5563564"]
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[35]+"</a><br><a href="+links[1]+">"+allQuads[36]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "13") { //Middle Colonial
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5367946","http://ims.er.usgs.gov/gda_services/download?item_id=5368306","http://ims.er.usgs.gov/gda_services/download?item_id=5368336","http://ims.er.usgs.gov/gda_services/download?item_id=5413838"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[37]+"</a><br><a href="+links[1]+">"+allQuads[38]+"</a><br><a href="+links[2]+">"+allQuads[39]+"</a><br><a href="+links[3]+">"+allQuads[40]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "14") { //Allegheny
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5329652","http://ims.er.usgs.gov/gda_services/download?item_id=5327890","http://ims.er.usgs.gov/gda_services/download?item_id=5677498"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[41]+"</a><br><a href="+links[1]+">"+allQuads[42]+"</a><br><a href="+links[2]+">"+allQuads[43]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "15") {//Appalachian
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5333994","http://ims.er.usgs.gov/gda_services/download?item_id=5292066","http://ims.er.usgs.gov/gda_services/download?item_id=5332872","http://ims.er.usgs.gov/gda_services/download?item_id=5337046",												"http://ims.er.usgs.gov/gda_services/download?item_id=5360934"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[44]+"</a><br><a href="+links[1]+">"+allQuads[45]+"</a><br><a href="+links[2]+">"+allQuads[46]+"</a><br><a href="+links[3]+">"+allQuads[47]+"</a><br><a href="+links[4]+">"+allQuads[48]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "16") { //North South Border
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5574786","http://ims.er.usgs.gov/gda_services/download?item_id=5292886","http://ims.er.usgs.gov/gda_services/download?item_id=5574856"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[49]+"</a><br><a href="+links[1]+">"+allQuads[50]+"</a><br><a href="+links[1]+">"+allQuads[52]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "17") { //Ozark
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5472469","http://ims.er.usgs.gov/gda_services/download?item_id=5429478"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[51]+"</a><br><a href="+links[1]+">"+allQuads[53]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 
						 if(id == "18") { //No data for Central Oklahoma-Kansas!
							var links = [""];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 
						 if(id == "19") { //Southeastern Plantation
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5302852","http://ims.er.usgs.gov/gda_services/download?item_id=5386912","http://ims.er.usgs.gov/gda_services/download?item_id=5539617","http://ims.er.usgs.gov/gda_services/download?item_id=5374668",												"http://ims.er.usgs.gov/gda_services/download?item_id=5679138"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[54]+"</a><br><a href="+links[1]+">"+allQuads[55]+"</a><br><a href="+links[2]+">"+allQuads[56]+"</a><br><a href="+links[3]+">"+allQuads[57]+"</a><br><a href="+links[4]+">"+allQuads[58]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "20") { //Delta Plantation
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5598602","http://ims.er.usgs.gov/gda_services/download?item_id=5598658"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[59]+"</a><br><a href="+links[1]+">"+allQuads[60]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "21") { //Southwestern Plantation
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5481279","http://ims.er.usgs.gov/gda_services/download?item_id=5489709","http://ims.er.usgs.gov/gda_services/download?item_id=5594686"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[61]+"</a><br><a href="+links[1]+">"+allQuads[62]+"</a><br><a href="+links[1]+">"+allQuads[63]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "22") { //Cattle Trails
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5478067","http://ims.er.usgs.gov/gda_services/download?item_id=5483873"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[64]+"</a><br><a href="+links[1]+">"+allQuads[65]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "23") { //Southern Colonial Flat Woods
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5622136","http://ims.er.usgs.gov/gda_services/download?item_id=5364896","http://ims.er.usgs.gov/gda_services/download?item_id=5621162"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[66]+"</a><br><a href="+links[1]+">"+allQuads[67]+"</a><br><a href="+links[1]+">"+allQuads[68]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "24") { //Florida Semi-Tropical
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5625118"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[69]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "25") { //Fremch Louisiana
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5594546"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[71]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "26") { //Gulf Spanish American
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5485577"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[70]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "27") { //Central Spanish American
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5379644","http://ims.er.usgs.gov/gda_services/download?item_id=5487443","http://ims.er.usgs.gov/gda_services/download?item_id=5385682"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[72]+"</a><br><a href="+links[1]+">"+allQuads[73]+"</a><br><a href="+links[1]+">"+allQuads[74]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "28") { //Desert Mexican American
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5547656","http://ims.er.usgs.gov/gda_services/download?item_id=5548746"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[75]+"</a><br><a href="+links[1]+">"+allQuads[76]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "29") { //Mexican Navajo Pueblo
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5386278"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[77]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "30") { //Rocky mountain
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5401876","http://ims.er.usgs.gov/gda_services/download?item_id=5401426","http://ims.er.usgs.gov/gda_services/download?item_id=5396590","http://ims.er.usgs.gov/gda_services/download?item_id=5353897",												"http://ims.er.usgs.gov/gda_services/download?item_id=5353989","http://ims.er.usgs.gov/gda_services/download?item_id=5354431"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[78]+"</a><br><a href="+links[1]+">"+allQuads[79]+"</a><br><a href="+links[2]+">"+allQuads[80]+"</a><br><a href="+links[3]+">"+allQuads[81]+"</a><br><a href="+links[4]+">"+allQuads[82]+"</a><br><a href="+links[5]	+">"+allQuads[83]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "31") { //Mormon
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5455449","http://ims.er.usgs.gov/gda_services/download?item_id=5455677","http://ims.er.usgs.gov/gda_services/download?item_id=5462745"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[84]+"</a><br><a href="+links[1]+">"+allQuads[85]+"</a><br><a href="+links[1]+">"+allQuads[86]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "32") { //Factory Farm Area
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5514931","http://ims.er.usgs.gov/gda_services/download?item_id=5502297","http://ims.er.usgs.gov/gda_services/download?item_id=5504413","http://ims.er.usgs.gov/gda_services/download?item_id=5510279","http://ims.er.usgs.gov/gda_services/download?item_id=5657642","http://ims.er.usgs.gov/gda_services/download?item_id=5501263","http://ims.er.usgs.gov/gda_services/download?item_id=5521601"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[87]+"</a><br><a href="+links[1]+">"+allQuads[88]+"</a><br><a href="+links[2]+">"+allQuads[89]+"</a><br><a href="+links[3]+">"+allQuads[90]+"</a><br><a href="+links[4]+">"+allQuads[91]+"</a><br><a href="+links[5]	+">"+allQuads[92]+"</a><br><a href="+links[3]+">"+allQuads[93]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "33") { //Pacific Forest Grazing
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5544428","http://ims.er.usgs.gov/gda_services/download?item_id=5682967"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[94]+"</a><br><a href="+links[1]+">"+allQuads[97]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
						 if(id == "34") { //Northwest Frontier
							var links = ["http://ims.er.usgs.gov/gda_services/download?item_id=5409786","http://ims.er.usgs.gov/gda_services/download?item_id=5434403","http://ims.er.usgs.gov/gda_services/download?item_id=5409872","http://ims.er.usgs.gov/gda_services/download?item_id=5687033"];
							var txt = "<div align = center style = 'color:white'>"+selection+"</div>";
							var hyper = "<div align = left><a href="+links[0]+">"+allQuads[95]+"</a><br><a href="+links[1]+">"+allQuads[96]+"</a><br><a href="+links[2]+">"+allQuads[98]+"</a><br><a href="+links[3]+">"+allQuads[99]+"</a></div>";
							 document.getElementById("info").innerHTML = txt;
							 document.getElementById("downloads").innerHTML = hyper;
						 };
							 
						 });
					 console.log(selection);
					 console.log(id);
					 //document.getElementById("culture").innerHTML = selection;
				 };
		  		//selection query fired off by "click"
				 this.map.on("click", function(evt){
					var rQuery = new Query();
					rQuery.geometry = evt.mapPoint;
					Rural.selectFeatures(rQuery,FeatureLayer.SELECTION_NEW)
				 });
				
				 //resume with original code :)
				
		  		
				 // make sure map is loaded
				if (this.map.loaded) {
					// do something with the map
					this._mapLoaded();
				} else {
					on.once(this.map, "load", lang.hitch(this, function () {
						// do something with the map
						this._mapLoaded();
					}));
				}
			}), this.reportError);
		},

		// Map is ready
		_mapLoaded:function () {
			// remove loading class from body
			domClass.remove(document.body, "app-loading");

			if (this.sharingUtils.urlQueryObject !== null) {
				var _mp = new Point([this.sharingUtils.urlQueryObject.clickLat, this.sharingUtils.urlQueryObject.clickLng], new SpatialReference({
					wkid:102100
				}));
				
				// add crosshair
				this.userInterfaceUtils.addCrosshair(_mp);
			}

			//// external logic ////
			// Load the Geocoder Dijit
			this._initGeocoderDijit("geocoder");
		
			on(this.map, "click", lang.hitch(this, this.mapUtils.mapClickHandler));
			on(this.map, "extent-change", lang.hitch(this, this.mapUtils.mapExtentChangeHandler));
			on(this.map, "update-start", lang.hitch(this, this.mapUtils.updateStartHandler));
			on(this.map, "update-end", lang.hitch(this, this.mapUtils.updateEndHandler));
			on(document, ".share_facebook:click", lang.hitch(this, this.sharingUtils.shareFacebook));
			on(document, ".share_twitter:click", lang.hitch(this, this.sharingUtils.shareTwitter));
			on(document, ".share_bitly:click", lang.hitch(this, this.sharingUtils.requestBitly));
			on(document, "click", lang.hitch(this, this.sharingUtils.documentClickHandler));
			
			

			this.mapUtils.currentMapExtent = this.map.extent;
			this._initUrlParamData(this.sharingUtils.urlQueryObject);
		},

		_initUrlParamData:function (urlQueryObject) {
			if (urlQueryObject) {

				var _mp = new Point([urlQueryObject.clickLat, urlQueryObject.clickLng], new SpatialReference({
					wkid:102100
				
				}));
				var pt = new Point ([34,-119], new SpatialReference({wkid:102100}));
				
				

				if (urlQueryObject.oids.length > 0) {
					var qt = new QueryTask(this.config.IMAGE_SERVER);
					var q = new Query();
					q.returnGeometry = true;
					q.outFields = this.config.OUTFIELDS;
					q.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;
					if (this.config.QUERY_GEOMETRY === "MAP_POINT") {
						q.geometry = _mp;
						
					} else {
						q.geometry = this.mapUtils.currentMapExtent.expand(this.config.EXTENT_EXPAND);
					}

					var deferreds = [];
					// we need to fire off a query for 'each' OID, not all at once
					array.forEach(urlQueryObject.oids.split("|"), function (oid) {
						//var deferred = new Deferred();
						q.where = "OBJECTID = " + oid;
						var deferred = qt.execute(q).addCallback(function (rs) {
							return rs.features[0];
						});
						deferreds.push(deferred);
					});// END forEach

					var layers = [];
					all(deferreds).then(lang.hitch(this, function (results) {
						var downloadIds = urlQueryObject.dlids.split("|");
						array.forEach(results, lang.hitch(this, function (feature, index) {
							var objID = feature.attributes.OBJECTID;
							var mapName = feature.attributes[this.config.ATTRIBUTE_MAP_NAME];
							var extent = feature.geometry.getExtent();
							var dateCurrent = new Date(feature.attributes[this.config.ATTRIBUTE_DATE]);

							if (dateCurrent === undefined || dateCurrent === null || dateCurrent === "") {
								dateCurrent = this.config.MSG_UNKNOWN;
							}

							var scale = feature.attributes[this.config.ATTRIBUTE_SCALE];
							var scaleLabel = number.format(scale, {
								places:0
							});
							var lodThreshold = this.timelineLegendUtils.setLodThreshold(scale, this.config.TIMELINE_LEGEND_VALUES, this.timelineLegendUtils.nScales, this.timelineLegendUtils.minScaleValue, this.timelineLegendUtils.maxScaleValue);

							var mosaicRule = new MosaicRule({
								"method":MosaicRule.METHOD_CENTER,
								"ascending":true,
								"operation":MosaicRule.OPERATION_FIRST,
								"where":"OBJECTID = " + objID
							});
							params = new ImageServiceParameters();
							params.noData = 0;
							params.mosaicRule = mosaicRule;
							imageServiceLayer = new ArcGISImageServiceLayer(this.config.IMAGE_SERVER, {
								imageServiceParameters:params,
								opacity:1.0
							
							});
							/*var polygonJson  = {"rings":[[[-122.63,45.52],[-122.57,45.53],[-122.52,45.50],[-122.49,45.48],
    						[-122.64,45.49],[-122.63,45.52],[-122.63,45.52]]],"spatialReference":{"wkid":4326 }};
  							var polygon = new Polygon(polygonJson);
							 */
							layers.push(imageServiceLayer);
							var url = "http://services.arcgis.com/rOo16HdIMeOBI4Mb/arcgis/rest/services/Portland_Parks/FeatureServer/0";
							var fl = new FeatureLayer(url);
							this.map.addLayer(fl);

							this.gridUtils.store.put({
								id:"1",
								objID:objID,
								layer:imageServiceLayer,
								name:mapName,
								imprintYear:dateCurrent,
								scale:scale,
								scaleLabel:scaleLabel,
								lodThreshold:lodThreshold,
								downloadLink:this.config.DOWNLOAD_PATH + downloadIds[index],
								extent:extent
							});
						}));// End forEach
						return layers.reverse();
					})).then(lang.hitch(this, function (layers) {
								array.forEach(layers, lang.hitch(this, function (layer, index) {
									this.map.addLayer(layer, index + 1);
									
								}));
								
								
							}));// END all

					// expand height of timeline parent container
					this.userInterfaceUtils.updateTimelineContainerHeight(timelineHeight);
					this.userInterfaceUtils.hideStep(".stepOne", "");
					this.userInterfaceUtils.showGrid();
					this.timelineUtils.runQuery(this.mapUtils.currentMapExtent, _mp, urlQueryObject.zl);
				} else {
					// TODO there are no OID's, check if the timeline was visible
					if (_mp) {
						this.timelineUtils.runQuery(this.mapUtils.currentMapExtent, _mp, urlQueryObject.zl);
					}
				}
			}
		},

		_initGeocoderDijit:function (srcRef) {
			var geocoder = new Geocoder({
				map:this.map,
				autoComplete:true,
				showResults:true,
				searchDelay:250,
				arcgisGeocoder:{
					placeholder:"Find a place"
				}
			}, srcRef);
			geocoder.startup();
		},
		
	});
});