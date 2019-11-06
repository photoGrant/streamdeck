/**
CapturePilotWebClient
*Requires Jquery

CapturePilot is a singleton that handles all communication with the server, and callbacks for the theme to bind to.

**/

function Variant(uuid_in) {
	this.UUID = uuid_in;
	this.Aperture = "";
	this.ColorTag = 0;
	this.Rating = 0;
	this.Editable = false;
	this.FocalLength = "";
	this.Height = "";
    this.Width = "";
	this.ISO = "";
	this.ShutterSpeed = "";
	this.Name = "";
	this.VariantNumber = "";
	this.ImageVariantCount = 1;
	this.ImageUUID = "";
	
	this.loadThumbnailAsync = function(width, height) {
		return CapturePilot.loadVariantThumbnailAsync(this, width, height);		
	};
	this.loadPreviewAsync = function(width, height, cropTop, cropBottom, cropLeft, cropRight) {
		return CapturePilot.loadVariantPreviewAsync(this, width, height, cropTop, cropBottom, cropLeft, cropRight);
	};
	this.setRating = function(newRating) {
		return CapturePilot.setVariantRating(this, newRating);
	}
	this.setColorTag = function(newColorTag) {
		return CapturePilot.setVariantColorTag(this, newColorTag);
	}
	//UUID is escaped and encoded so it can be used as an HTML attribute. If it is sent back to the server first unescape(decodeURIComponent(uuid)) must be called on the string
	//escape and encode, as encode doesnt get single quotes, and escape doesnt get weird characters   
	this.encodedUUID = function() { return encodeURIComponent(this.UUID).replace("'", "%27"); }
}
function decodedVariantUUID(encodedUUID) { return decodeURIComponent(encodedUUID.replace("%27", "'")); }


var CapturePilot = (function () {
    var _variants = [],
		_sessionID = 0,
		_revision = -1,
		_collectionProperties = {},
		_connectRetryCount = 0, _connectRetryLimit = 5, _connectRetryDelay = 1000,
		_resyncRetryCount = 0, _resyncRetryLimit = 5, _resyncRetryDelay = 1000;
	
	function HandleServerData(serverData) {
		if (serverData) {
			var ourRevision = parseInt(_revision) + 1;
			var serverRevision = parseInt(serverData["revision"]);
           	_revision = serverData["revision"];
			if (ourRevision==0 || ourRevision==serverRevision) {
		        _resyncRetryCount = 0;
		        UpdateClient(serverData);        
				GetServerChanges();  
		        return true;
           	}
        }
        
        //out of sync! retry
        _resyncRetryCount++;
		if (_resyncRetryCount < _resyncRetryLimit) {
			window.setTimeout(function() { GetServerState(); }, _resyncRetryDelay);
		} else {
			//tell the client that the server has disconnected
	    	$(CapturePilot).trigger("disconnected");
		}
		return false;
	}
	
	function GetServerState() {
		$.getJSON(
		"getServerState?sessionID=" + _sessionID + "&timestamp="+Date.now(),
        {cache: false})
        .done(function (parsedData) {
        	HandleServerData(parsedData);        	
        })
        .fail(function (data) {
        	HandleServerData(false);
        });
	}
	
	// long polling function to get all the changes from the server.
    function GetServerChanges() {
        $.getJSON(
        "getServerChanges?sessionID=" + _sessionID + "&timestamp="+Date.now(),
        {cache: false})
		.done(function (parsedData) {
		    if (parsedData) {
	        	HandleServerData(parsedData);
	        } else {		    	
		        GetServerChanges(); //no data - it's a timeout - just restart
		    }
		})
		.fail(function (data) {
        	HandleServerData(false);
		});
    }
	
	// handle the data returned from the server - trigger callbacks for the client
    function UpdateClient(data) {
        try {			
			//check for server changes
			var listOfObjects = data.objects;
			var objectCnt = (listOfObjects !== undefined) ? listOfObjects.length : 0;
			if (objectCnt > 0) {
				for (var i = 0; i < objectCnt; i++) {
					var objectData = listOfObjects[i];
					
					if (objectData.kObjectKey_ObjectType == "kObjectType_CPServer") {
						var changeType = objectData.kObjectKey_ChangeType;						
						//convert server properties
						var changedProperties = {};
						for (var p=0; p<objectData.kObjectKey_Properties.length; p++) {
							changedProperties[objectData.kObjectKey_Properties[p].kObjectProperty_PropertyID.replace("kServerProperty_", "")] = { 
								value: objectData.kObjectKey_Properties[p].kObjectProperty_CurrentValue,
								permissions: objectData.kObjectKey_Properties[p].kObjectProperty_Permissions,
								valueType: objectData.kObjectKey_Properties[p].kObjectProperty_ValueType
							};
						}
						
						//console.log(changeType+" server");
						if (changeType == "new") {
							_collectionProperties = changedProperties;
							$(CapturePilot).trigger("collectionChanged", [_collectionProperties]);
						} else if (changeType == "modified") {
							$.extend(true, _collectionProperties, changedProperties);
							if (changedProperties["WebThemeName"] !== undefined) {
								//force a hard-restart if the theme changed.
								ThemeChanged();
								return;
							}
				            $(CapturePilot).trigger("collectionPropertiesModified", [changedProperties]);
						}
					}
				}
			}
						
			//check for variant changes
            var listOfVariants = data.variants; // an array of new/deleted/modified variants
			var variantCnt = (listOfVariants !== undefined) ? listOfVariants.length : 0;			
            if (variantCnt > 0) {            
	            var addedVariants = [],
	            	modifiedVariants = [],
	            	deletedVariants = [],
	            	metadataVariants = [];
	            	
	            for (var i = 0; i < variantCnt; i++) {
	                var variantData = listOfVariants[i];
	                
	                switch (variantData.kVariantKey_ChangeType) {
	                    case "new":
	                        addedVariants.push(variantData);
	                        break;
	                    case "modified":
	                        modifiedVariants.push(variantData);
	                        break;
	                    case "metadata":
	                        metadataVariants.push(variantData);
	                        break;
	                    case "deleted":
	                        deletedVariants.push(variantData);
	                        break;
	                }
	            }
				//console.log(addedVariants.length + " new, "+deletedVariants.length+" removed, "+modifiedVariants.length+" modified, "+metadataVariants.length+" metadataChanged");
				
		        DeleteVariants(deletedVariants); //must delete before add (efficiency and ui considerations)
		        AddVariants(addedVariants); //add must be before modify, so variants actually exist             	
		        RefreshVariantMetdata(metadataVariants);            	            
		        RefreshVariants(modifiedVariants);
			}			
        }
        catch (err) {
            //console.error("Error Updating Client:", err);
        }
    }    
    function GetVariantWithUUID(uuid) {
    	if (!uuid) return null;
        var varCnt = _variants.length;
        for (var i = 0; i < varCnt; i++) {
            var v = _variants[i];
            if (v.UUID == uuid)
                return v;
        }
        return null;
    }
    
    function ThemeChanged() {    
		window.location.reload();
    }
    
	//add a variant to the 
    function AddVariants(variants) {
        if (variants === undefined)
            return;
        var newVariants = [];
        var varCnt = variants.length;
        for (var i = 0; i < varCnt; i++) {
            var v = AddVariant(variants[i]);
            if (v) newVariants.push(v);
        }

        if (newVariants.length > 0)
            $(CapturePilot).trigger("variantsAdded", [newVariants]);
        
        return newVariants;
    }
    function AddVariant(variantData) {
        // check if it exist first   
        var uuid = variantData.kVariantKey_VariantID;
        if (!uuid) return null;
        
        //go through all the variants, looking for where to add the variant (or if it already exists)
        var otherVariants = [];
        var varCnt = _variants.length;
        var insertIndex = -1;
        for (var i = 0; i < varCnt; i++) {
            var v = _variants[i];            
            if (v.UUID == uuid)
                return null;
            
            if (v.ImageUUID == variantData.kVariantKey_ImageID)
	            otherVariants.push(v);
        }
        
        var variant = new Variant(variantData.kVariantKey_VariantID);
        ApplyVariantDataToVariant(variant, variantData);
        
        varCnt = otherVariants.length;
        variant.ImageVariantCount = varCnt+1;
        for (var i=0; i<varCnt; i++)
        	otherVariants[i].ImageVariantCount = varCnt+1;

        _variants.push(variant);
        
        return variant;

    }
    function DeleteVariants(deletedVariantsData) {
        var deletedVariants = [];
        for (var j = 0; j < deletedVariantsData.length; j++) {
            var variantID = deletedVariantsData[j].kVariantKey_VariantID;
            var variant = GetVariantWithUUID(variantID);
            var variantImageID = (variant)?variant.ImageUUID:null;
            
            var otherVariants = [];
            for (var i = 0; i < _variants.length; i++) {            
            	var v = _variants[i];
	 	           
                if (v.UUID == variantID) {
                    deletedVariants.push(v);
                    _variants.splice(i, 1); // remove this variant
                    i--;
                } else if (v.ImageUUID == variantImageID) {
	 	           otherVariants.push(v);
                }
            }
            
	        var varCnt = otherVariants.length;
	        for (var i=0; i<varCnt; i++)
	        	otherVariants[i].ImageVariantCount = varCnt;	        
        }		
        
        if (deletedVariants.length > 0)
            $(CapturePilot).trigger("variantsRemoved", [deletedVariants]);
        
        return deletedVariants;
    }

    function RefreshVariants(modifiedVariantsData) {
        var modifiedVariants = [];

        for (var i = 0; i < modifiedVariantsData.length; i++) {
            var variant = GetVariantWithUUID(modifiedVariantsData[i].kVariantKey_VariantID);
            modifiedVariants.push(variant);
        }

        if (modifiedVariants.length > 0)
        	$(CapturePilot).trigger("variantsModified", [modifiedVariants]);
    }

    function RefreshVariantMetdata(modifiedVariantsData) {
        var modifiedVariants = [];

        for (var i = 0; i < modifiedVariantsData.length; i++) {
        	var modifiedData = modifiedVariantsData[i];
            var variant = GetVariantWithUUID(modifiedData.kVariantKey_VariantID);
            
            ApplyVariantDataToVariant(variant, modifiedData);
            
            modifiedVariants.push(variant);
        }

        if (modifiedVariants.length > 0)
	        $(CapturePilot).trigger("variantsMetadataModified", [modifiedVariants]);
    }
	function ApplyVariantDataToVariant(variant, variantData) {
		if (!variant || !variantData)
			return;
					
		if (variantData.kVariantKey_VariantNo != undefined) variant.VariantNumber = variantData.kVariantKey_VariantNo;
        if (variantData.kVariantKey_ImageID != undefined) variant.ImageUUID = variantData.kVariantKey_ImageID;
        if (variantData.kVariantKey_VariantName != undefined) variant.Name = variantData.kVariantKey_VariantName;
        var properties = variantData.kVariantKey_Properties;
        if (properties != undefined) {
        	if (properties.kVariantProperty_Height != undefined) variant.Height = variantData.kVariantKey_Properties.kVariantProperty_Height;
        	if (properties.kVariantProperty_Width != undefined) variant.Width = variantData.kVariantKey_Properties.kVariantProperty_Width;
        	if (properties.kVariantProperty_Aperture != undefined) variant.Aperture = variantData.kVariantKey_Properties.kVariantProperty_Aperture;
        	if (properties.kVariantProperty_Colortag != undefined) variant.ColorTag = variantData.kVariantKey_Properties.kVariantProperty_Colortag;
        	if (properties.kVariantProperty_Editable != undefined) variant.Editable = variantData.kVariantKey_Properties.kVariantProperty_Editable;
        	if (properties.kVariantProperty_FocalLength != undefined) variant.FocalLength = variantData.kVariantKey_Properties.kVariantProperty_FocalLength;
        	if (properties.kVariantProperty_ISO != undefined) variant.ISO = variantData.kVariantKey_Properties.kVariantProperty_ISO;
        	if (properties.kVariantProperty_Rating != undefined) variant.Rating = variantData.kVariantKey_Properties.kVariantProperty_Rating;
        	if (properties.kVariantProperty_ShutterSpeed != undefined) variant.ShutterSpeed = variantData.kVariantKey_Properties.kVariantProperty_ShutterSpeed;        
        }
	}
	function IsPropertyEnabled(propertyName) {
    	try {
        	return (_collectionProperties[propertyName].value == "enabled");
    	} catch (err) {
			return false;
    	}
	}
	
    //public interfaces
    return {
        //start connecting to the server
        connect: function (password) {
            var result = false;
            //console.log("Connecting to server...");
			
			if ( navigator.userAgent.indexOf("MSIE ") > 0 && parseInt(/\brv[ :]+(\d+)/g.exec( navigator.userAgent)[1], 10)<= 8 ) {				
				$(CapturePilot).trigger("connected", [false, "UnsupportedBrowser"]);
				return false;
			}
			
			if (password!==undefined)
				password = "&password="+SHA1(password);
			else
				password = "";
					        	
            $.post("connectToService?protocolVersion=2.4" + password + "&timestamp="+Date.now(), {cache: false} )
		  	.always(function (data) {
		  	    _sessionID = parseInt(data, 10);
		  	    if (!_sessionID)
		  	        _sessionID = 0;

		  	    result = (_sessionID != 0);
		  	    if (result) {			  	    
		  	    	_connectRetryCount = 0;
			  	    $(CapturePilot).trigger("connected", true);
		  	        GetServerChanges();
		  	    }else if (data.status == 401) {
		  	    	_connectRetryCount = 0;
		  	    	$(CapturePilot).trigger("connected", [false, "AuthenticationFailed"]);
					return false;
		  	    }else {
		  	    	_connectRetryCount++;
		  	    	if (_connectRetryCount < _connectRetryLimit) {
						//retry after 1sec delay.			
						window.setTimeout(function() { CapturePilot.connect(); }, _connectRetryDelay);
					} else {
				  	    //console.log("...Failed to connect", data);
				  	    $(CapturePilot).trigger("connected", false);
					}
		  	    }
		  	});
        },
        
        //get variant object from uuid
        getVariant: function (uuid, isUUIDEncoded) { 
        	if (!uuid) return null;
        	return GetVariantWithUUID((isUUIDEncoded===true) ? decodedVariantUUID(uuid) : uuid); 
        },

        //get collection properties
        getVariantCount: function () {
            return _variants.length;
        },

        getCollectionProperties: function () {
            return _collectionProperties;
        },


        //start loading a _variants preview, return base64 data as src
        loadVariantPreviewAsync: function (variant, width, height, cropTop, cropBottom, cropLeft, cropRight) {
            if (!variant)
                return false;
                
            //default no crop
            if (cropTop === undefined || cropBottom === undefined || cropLeft === undefined || cropRight === undefined)
                cropTop = cropBottom = cropLeft = cropRight = 0;

            $.get("getImage?sessionID=" + _sessionID + "&id=" + variant.encodedUUID() + "&bottom=" + cropBottom + "&left=" + cropLeft + "&right=" + cropRight + "&top=" + cropTop + "&height=" + height + "&width=" + width + "&timestamp="+Date.now(),
	        {cache: false})
			.done(function (data, textStatus, jqXHR) {
				var imgSrc = false;
				var errText = "HTTP/";
				if (jqXHR.responseText.substring(0, errText.length) !== errText)
					imgSrc = "data:image/jpeg;base64,"+jqXHR.responseText;
			    $(CapturePilot).trigger("previewLoaded", [variant, imgSrc]);
			})
			.fail(function (data) {
			    $(CapturePilot).trigger("previewLoaded", [variant, false]);
			});
            return true;
        },

        //start loading a _variants thumbnail
        loadVariantThumbnailAsync: function (variant, width, height) {
            if (!variant)
                return false;

            $.get("getImage?sessionID=" + _sessionID + "&id=" + variant.encodedUUID() + "&bottom=0&left=0&right=0&top=0&height=" + height + "&width=" + width + "&timestamp="+Date.now(),
	        {cache: false})
			.done(function (data, textStatus, jqXHR) {	
				var imgSrc = false;
				var errText = "HTTP/";
				if (jqXHR.responseText.substring(0, errText.length) !== errText)
					imgSrc = "data:image/jpeg;base64,"+jqXHR.responseText;
			    $(CapturePilot).trigger("thumbnailLoaded", [variant, imgSrc]);
			})
			.fail(function (data) {
			    $(CapturePilot).trigger("thumbnailLoaded", [variant, false]);
			});
            return true;
        },
        
        canSetRating: function () { return IsPropertyEnabled("Rating_Permission"); },
        setVariantRating: function (variant, rating) {
        	if (!variant || this.canSetRating()==false)
                return;
			
            $.get("setProperty?sessionID=" + _sessionID + "&objectType=kObjectType_ImageAdjustments&objectID=" + variant.encodedUUID() + "&propertyID=kImageAdjustmentProperty_Rating&propertyValue="+parseInt(rating)+"&timestamp="+Date.now(),
	        {cache: false});
        },
                
        canSetColorTag: function () { return IsPropertyEnabled("ColorTag_Permission"); },
        setVariantColorTag: function (variant, colorTag) {
        	if (!variant || this.canSetColorTag()==false)
                return;
            $.get("setProperty?sessionID=" + _sessionID + "&objectType=kObjectType_ImageAdjustments&objectID=" + variant.encodedUUID() + "&propertyID=kImageAdjustmentProperty_ColorTag&propertyValue="+parseInt(colorTag)+"&timestamp="+Date.now(),
	        {cache: false});
        }
    };
})();



/*********************************/
/* UTILITY METHODS */



/**
*
*  Secure Hash Algorithm (SHA1)
*  http://www.webtoolkit.info/
*
**/
 
function SHA1 (msg) {
 
	function rotate_left(n,s) {
		var t4 = ( n<<s ) | (n>>>(32-s));
		return t4;
	};
 
	function lsb_hex(val) {
		var str="";
		var i;
		var vh;
		var vl;
 
		for( i=0; i<=6; i+=2 ) {
			vh = (val>>>(i*4+4))&0x0f;
			vl = (val>>>(i*4))&0x0f;
			str += vh.toString(16) + vl.toString(16);
		}
		return str;
	};
 
	function cvt_hex(val) {
		var str="";
		var i;
		var v;
 
		for( i=7; i>=0; i-- ) {
			v = (val>>>(i*4))&0x0f;
			str += v.toString(16);
		}
		return str;
	};
 
 
	function Utf8Encode(string) {
		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
 
		for (var n = 0; n < string.length; n++) {
 
			var c = string.charCodeAt(n);
 
			if (c < 128) {
				utftext += String.fromCharCode(c);
			}
			else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			}
			else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
 
		}
 
		return utftext;
	};
 
	var blockstart;
	var i, j;
	var W = new Array(80);
	var H0 = 0x67452301;
	var H1 = 0xEFCDAB89;
	var H2 = 0x98BADCFE;
	var H3 = 0x10325476;
	var H4 = 0xC3D2E1F0;
	var A, B, C, D, E;
	var temp;
 
	msg = Utf8Encode(msg);
 
	var msg_len = msg.length;
 
	var word_array = new Array();
	for( i=0; i<msg_len-3; i+=4 ) {
		j = msg.charCodeAt(i)<<24 | msg.charCodeAt(i+1)<<16 |
		msg.charCodeAt(i+2)<<8 | msg.charCodeAt(i+3);
		word_array.push( j );
	}
 
	switch( msg_len % 4 ) {
		case 0:
			i = 0x080000000;
		break;
		case 1:
			i = msg.charCodeAt(msg_len-1)<<24 | 0x0800000;
		break;
 
		case 2:
			i = msg.charCodeAt(msg_len-2)<<24 | msg.charCodeAt(msg_len-1)<<16 | 0x08000;
		break;
 
		case 3:
			i = msg.charCodeAt(msg_len-3)<<24 | msg.charCodeAt(msg_len-2)<<16 | msg.charCodeAt(msg_len-1)<<8	| 0x80;
		break;
	}
 
	word_array.push( i );
 
	while( (word_array.length % 16) != 14 ) word_array.push( 0 );
 
	word_array.push( msg_len>>>29 );
	word_array.push( (msg_len<<3)&0x0ffffffff );
 
 
	for ( blockstart=0; blockstart<word_array.length; blockstart+=16 ) {
 
		for( i=0; i<16; i++ ) W[i] = word_array[blockstart+i];
		for( i=16; i<=79; i++ ) W[i] = rotate_left(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);
 
		A = H0;
		B = H1;
		C = H2;
		D = H3;
		E = H4;
 
		for( i= 0; i<=19; i++ ) {
			temp = (rotate_left(A,5) + ((B&C) | (~B&D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
			E = D;
			D = C;
			C = rotate_left(B,30);
			B = A;
			A = temp;
		}
 
		for( i=20; i<=39; i++ ) {
			temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
			E = D;
			D = C;
			C = rotate_left(B,30);
			B = A;
			A = temp;
		}
 
		for( i=40; i<=59; i++ ) {
			temp = (rotate_left(A,5) + ((B&C) | (B&D) | (C&D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
			E = D;
			D = C;
			C = rotate_left(B,30);
			B = A;
			A = temp;
		}
 
		for( i=60; i<=79; i++ ) {
			temp = (rotate_left(A,5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
			E = D;
			D = C;
			C = rotate_left(B,30);
			B = A;
			A = temp;
		}
 
		H0 = (H0 + A) & 0x0ffffffff;
		H1 = (H1 + B) & 0x0ffffffff;
		H2 = (H2 + C) & 0x0ffffffff;
		H3 = (H3 + D) & 0x0ffffffff;
		H4 = (H4 + E) & 0x0ffffffff;
 
	}
 
	var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
 
	return temp.toLowerCase();
 
}