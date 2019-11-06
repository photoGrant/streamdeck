jQuery(document).ready(function($) {
$("noscript").remove();

var hideControlsAfterClickDuration = 15000, //ms
	hideControlsAfterOpenDuration = 5000; //ms
var hideControlsTimer, 
	loadPreviewTimer;

//TODO: use variant thumb sizes
var thumbSizes ={	small: {w:133,h:100},
					medium: {w:232,h:174},
					large:	{w:360, h:270}
				};

var showingPreview = false,
	previewUUID;

var catalogName = null;

var windowAspectRatio; 
var previewAspectRatio = 1,
	previewImageHeight = 0, 
	previewImageWidth = 0;

var $preview = $("#viewer-container .preview");

//////////////////////////////////
// GETTER UTILS 

//get thumbnail DOM object for a specific UUID
function GetThumbnailForUUID(uuid) { return $("#thumbnail-container .thumbnail[id='"+uuid+"']"); }

//is the collection currently empty?
function IsCollectionEmpty() { return (CapturePilot.getVariantCount() <= 0); }

function VariantName(variant) {
	if (!variant)
		return "";
	else if (variant.ImageVariantCount > 1)
		return variant.Name + " ("+(variant.VariantNumber+1)+")";
	else
		return variant.Name;
}

function supports_html5_storage() {
  try {
    return 'localStorage' in window && window['localStorage'] !== null;
  } catch (e) {
    return false;
  }
}

//////////////////////////////////
// UI UPDATE METHODS

// Update UI after the collection properties changes
function CollectionPropertiesChanged(changedProperties) {
	//Collection name changed
	if (changedProperties["SelectedFolder"] !== undefined) {
		var newTitle = changedProperties["SelectedFolder"].value;
		if (newTitle === undefined) newTitle = "Unknown Collection";
		catalogName = newTitle;
		
		$("#collection-title").html(newTitle);
		document.title = newTitle;		
	}
	
	$("#rating-control").toggleClass("disabled", !CapturePilot.canSetRating()).find("input").attr("disabled", !CapturePilot.canSetRating());
	if (!CapturePilot.canSetColorTag())
		$("#colortag-control").addClass("disabled").removeClass('open');
	else
		$("#colortag-control").removeClass('disabled');
	
}

// Update UI when new variants added - add dotted thumb outline and start loading visible thumbs
function VariantsAdded(variants, animated) {
	var varCnt = (variants) ? variants.length : 0;
	if (varCnt > 0) {
		$("#no-variants-label").hide();
		
		for(var i=0; i<varCnt; i++) {
			var variant = variants[i];
			
			var $newThumb = $('<div class="thumbnail thumbnail-not-loaded new-thumb" id="'+variant.encodedUUID()+'"><div class="thumbnail-image"><div class="thumbnail-loading"></div></div><div class="thumbnail-label">'+VariantName(variant)+'</div></div>').hide();
			
			$newThumb.data("variant", variant);			
			$newThumb.data("variantNumber", variant.VariantNumber);
			
			SortVariantThumb($newThumb);
		}
		
		$("#thumbnail-container .thumbnail.new-thumb").fadeIn("slow", function(){
			$(this).removeClass("new-thumb");
		}).promise().done(function() {	
			LoadVisibleThumbs();
		});
		
	}
}

// Update UI when some variants are removed - remove thumbs individually and close preview if necessary
//  ... or just clear view if collection empty and show no-variants label.
function VariantsRemoved(variants) {
	//get all thumbs to be removed
	var varCnt = (variants) ? variants.length : 0;
	for(var i=0; i<varCnt; i++) {
		var uuid = variants[i].encodedUUID();
		var $variantThumb = GetThumbnailForUUID(uuid);

		//if it is the active variant then close the preview
		if (previewUUID == uuid)
			ClosePreview();
		
		$variantThumb.addClass("removed-thumb");
		
		$("#thumbnail-container .thumbnail").each(function(){
			var thumbVariant = $(this).data("variant");
			if (thumbVariant.UUID!=variants[i].UUID && variants[i].ImageUUID==thumbVariant.ImageUUID)
				UpdateVariantThumbName($(this));
		});
	}
	
	//if all to be removed then clear the just delete, rather than fade
	if ($("#thumbnail-container .thumbnail:not(.removed-thumb)").length == 0) {
		$("#thumbnail-container .thumbnail").remove();
		$("#no-variants-label").fadeIn("fast");
	} else {
		$("#thumbnail-container .thumbnail.removed-thumb").remove();
	}
}

function CurrentThumbSize() {
	return thumbSizes.large;
}

// Transission to viewer for a specific UUID, initially using the thumb image (if it is loaded).
// ... also show the spinner and start loading the large preview (after a short period)
function OpenPreview(uuid, showControls) {
	var variant = CapturePilot.getVariant(uuid, true);
	if (!variant) return;
	
	//if the viewer is not currently showing the correct image, then use the thumbnail
	if (previewUUID !== uuid) {	
		$preview.find("img.preview-image, img.temp-preview").remove();
		
		//get the src of the thumb, and use that temporarily
		var $thumbnailImage = GetThumbnailForUUID(uuid).find(".thumbnail-image img");
		var thumbnailSrc = $thumbnailImage.attr("src");
		if (thumbnailSrc !== undefined && thumbnailSrc !== "") {
			var $tempPreviewImg = $preview.find("img.temp-preview");
			if ($tempPreviewImg.length <= 0) {
				$tempPreviewImg = $("<img class='temp-preview' src=''/>")				
				$preview.prepend($tempPreviewImg);
			}
			$tempPreviewImg.attr("src", thumbnailSrc).show();
			
			//update the preview's aspect ratio (only rough value from thumbnail)
			previewAspectRatio = ($thumbnailImage.width()!=0)?$thumbnailImage.height()/$thumbnailImage.width():0;
		} else {
			//start loading the thumb when we pass over it
			var sizeToLoad = CurrentThumbSize();
			variant.loadThumbnailAsync(sizeToLoad.w, sizeToLoad.h);
		}
		
		$preview.data('uuid', uuid);
		previewUUID = uuid;
	}
	showingPreview = true;
	
	var newHash = "#Preview/"+decodeURIComponent(uuid);
	if (window.location.hash != newHash)
		window.location.hash = newHash;
	
	document.title = VariantName(variant)+" - "+catalogName;
	
	//show the spinner
	if ($preview.find(".spinner").length <= 0)
    	$preview.append("<div class='spinner'><span>Loading</span></div>").ready(function() { RotateSpinner($preview.find(".spinner")); });
	
	
	SetPreviewRating(variant.Rating);	
	SetPreviewColorTag(variant.ColorTag);
	$("#preview-title").html(VariantName(variant));		
	$("#viewer-container").fadeIn('fast');	
	
	UpdatePreviewAspectRatio();
	
	//disable prev/next buttons
	$("#prev-variant-button").toggleClass("disabled", (PrevVariantUUID(uuid) == null));
	$("#next-variant-button").toggleClass("disabled", (NextVariantUUID(uuid) == null));
			
	//initially show toolbar, then hide after 3 secs
	if (showControls) {
		ToggleViewerControls(true);
		HideViewerControlsAfterDuration(hideControlsAfterOpenDuration);
	}
	
	//start loading the new full preview
	clearTimeout(loadPreviewTimer);
	loadPreviewTimer = setTimeout(function() {
		var previewHeight = $(window).height(),
			previewWidth = $(window).width();		
		if (variant.loadPreviewAsync(previewWidth, previewHeight) == false) {
			//TODO: maybe show some error in the preview view
			//console.error("Something went wrong starting the preview loading");
		}
	}, 500);
}

// Transission back to the browser view
function ClosePreview() {
	showingPreview = false;
	$("#viewer-container").fadeOut("fast");
	window.location.hash = "";
	document.title = catalogName;
}

// Show/Hide the viewer's toolbar
function ToggleViewerControls(show) {
	var speed = "fast";
	var toolbar = $("#viewer-container .toolbar");
	var controls = $("#viewer-container .controls");
	if (show===undefined) {
		toolbar.slideToggle(speed);
		controls.fadeToggle(speed);
	} else if (show) {
		toolbar.slideDown(speed);
		controls.fadeIn(speed);
	} else {
		toolbar.slideUp(speed);
		controls.fadeOut(speed);
	}
}

function HideViewerControlsAfterDuration(msDuration) {
	clearTimeout(hideControlsTimer);
	hideControlsTimer = setTimeout(function(){ 
		ToggleViewerControls(false);
	}, msDuration);
}

//Add / Remove classes to the preview so we know if it is taller or wider than the window (for nice scaling effect)
function UpdatePreviewAspectRatio() {
	if (showingPreview) {
		if (windowAspectRatio > previewAspectRatio && previewAspectRatio!=0) {
			$preview.removeClass("preview-taller").addClass("preview-wider");		
		} else {	
			$preview.removeClass("preview-wider").addClass("preview-taller");
		}
	}
}

//spin the spinner elem by 30degs repeatedly
function RotateSpinner(spinner, startAngle){ 
	if ($(spinner).parent().get(0) === undefined) 
		return;
	if (!startAngle || startAngle>=360) 
		startAngle = 0;
	$(spinner).rotate(startAngle+30);
	setTimeout(function() { RotateSpinner($(spinner), startAngle+30); }, 100);
}

function UpdateVariantThumbName(thumbnail) {
	var variant = $(thumbnail).data("variant");
	var variantName = VariantName(variant);			
	$(thumbnail).find(".thumbnail-label").html(variantName);
			
	if (showingPreview && previewUUID == variant.encodedUUID()) {
		$("#preview-title").html(variantName);
		document.title = variantName +" - "+catalogName;
	}
}

function SetPreviewRating(rating) {
	$("#rating-control input").attr('checked', false).filter("[value="+rating+"]").attr('checked', true);
}
function SetPreviewColorTag(colortag) {
	$("#colortag-control li").removeClass('active-tag');
	var activetag = $("#colortag-control li:eq("+colortag+")");
	if (!activetag)
		activetag = $("#colortag-control li:eq(0)");
	activetag.addClass('active-tag');
}

function SortVariantThumb(thumbnail) {
	$(thumbnail).detach();
	
	var variant = $(thumbnail).data("variant");
	
	//go through each thumbnail looking where to put the thumb
	var $previousThumb = null;
	var foundImageVariants = false;
	$("#thumbnail-container .thumbnail").each(function(){	
		var thumbVariant = $(this).data("variant");
		//it's the same image, so do a variant-number compare
		if (variant.ImageUUID == thumbVariant.ImageUUID) {
			UpdateVariantThumbName($(this));
			//it's before the 
			if (variant.VariantNumber <= thumbVariant.VariantNumber)
				return false;
				
			foundImageVariants = true;						
		} 
		//we've just gone past the group of variants from the same image, so use the previous thumbnail
		else if (foundImageVariants) {
			return false;
		}	
		$previousThumb = $(this);
	});
	
	if ($previousThumb != null) {
		$previousThumb.after(thumbnail);
	} else {
		$("#thumbnail-container").prepend(thumbnail);
	}
}


//////////////////////////////////
// NEXT / PREV VARIANT

//Get UUID of next / prev image in thumbnail list
function NextVariantUUID(currentUUID) {
	if (!currentUUID) return null;
	
	var $nextThumb = GetThumbnailForUUID(currentUUID).next().get(0);	
	return ($nextThumb) ? $nextThumb.id : null;
}
function PrevVariantUUID(currentUUID) {
	if (!currentUUID) return null;
	
	var $nextThumb = GetThumbnailForUUID(currentUUID).prev().get(0);	
	return ($nextThumb) ? $nextThumb.id : null;
}

// Trigger OpenPreview for Next/Prev image in thumbnail list
function OpenNextVariantPreview() {
	if (showingPreview === false)
		return;
	OpenPreview(NextVariantUUID(previewUUID), false);
}
function OpenPrevVariantPreview() {
	if (showingPreview === false)
		return;
	OpenPreview(PrevVariantUUID(previewUUID), false);
}



//////////////////////////////////
// THUMBNAIL LOADING 

// Load thumbs when they scroll into view
var scrollingTimeout = null;
$("#browser-container").scroll(function() { 
	clearTimeout(scrollingTimeout);
	scrollingTimeout = window.setTimeout(function(){ 
		LoadVisibleThumbs();
		scrollingTimeout = false;	
	}, 500);
});

// Is the specific element within the window's view?
function IsScrolledIntoView(elem)
{
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();

    return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom));
}

// Start loading thumbnails that are within the view
function LoadVisibleThumbs() {
	$("#thumbnail-container .thumbnail.thumbnail-not-loaded").each(function(index, element) {
		if (IsScrolledIntoView(element)) {
			$(element).removeClass("thumbnail-not-loaded");
			var sizeToLoad = CurrentThumbSize();
			CapturePilot.getVariant(element.id, true).loadThumbnailAsync(sizeToLoad.w, sizeToLoad.h);
		}
	});
}


//////////////////////////////////
// EVENT BINDING


// Handle Keyboard Shortcuts
$(window).keydown(function(event) {
	//only non-modified keys allowed, so we dont override system shortcuts
	if (event.altKey==false && event.metaKey==false && event.ctrlKey==false && event.shiftKey==false) 
	{
		var keyCode = event.which;
		//esc
		if (keyCode == '27') {
			ClosePreview();
			event.preventDefault();
			return;
		}
		//left arrow 
		if (keyCode == '37') {
			OpenPrevVariantPreview();
			event.preventDefault();
			return;
		}
		// Right arrow
		if (keyCode == '39') {
			OpenNextVariantPreview();
			event.preventDefault();
			return;
		}

		// Ratings: 0-5 keys (top row and numpad)
		var rating = null;
		if (keyCode >= 96 && keyCode <= 101) {
			rating = keyCode - 96;
		} else if (keyCode >= 48 && keyCode <= 53) {
			rating = keyCode - 48;
		}

		if (rating !== null && showingPreview) {
			
			var variant = CapturePilot.getVariant(previewUUID, true);
			variant.setRating(rating);

			event.preventDefault();

			return;
		}

		// Color tag default shortcuts:
		var colorTag = null;
		if (keyCode == 189 || keyCode == 109) { // -
			colorTag = 1; // Red
		} else if (keyCode == 187 || keyCode == 107) { // +
			colorTag = 4; // Green
		} else if (keyCode == 56 || keyCode == 106) { // *
			colorTag = 3; // Yellow
		}

		if (colorTag !== null && showingPreview) {
			var variant = CapturePilot.getVariant(previewUUID, true);
			variant.setColorTag(colorTag);

			event.preventDefault();

			return;
		}
	}
});


// Load thumbs and correctly resize preview when window is resized
$(window).resize(function() {
	var $win = $(window);	
	var winWidth = $win.width(),
		winHeight = $win.height();
	windowAspectRatio = (winWidth!=0) ? winHeight/winWidth : 0;
	
	//TODO: reload preview on resize up?
	
	
	//add classes to the preview so it scales properly
	UpdatePreviewAspectRatio();
	
	//check if new thumbs have come into view
	LoadVisibleThumbs();
}).trigger("resize");


// Bind to Next / Previous Image buttons
$('body').on("click", "#prev-variant-button", OpenPrevVariantPreview);
$('body').on("click", "#next-variant-button", OpenNextVariantPreview);

// Click on Thumbnail (loaded & loading) - now and all future matching DOM elements
$('body').on("click", ".thumbnail-image img, .thumbnail-image .thumbnail-loading", function(){	
	OpenPreview($(this).closest(".thumbnail").attr('id'), true);	
});

// Back button - return to browser view
$("#back-btn").click(function() { 
	ClosePreview(); 
});

// Show/Hide toolbar when clicking on the viewer image
$("#viewer-container .preview").click(function() { 
	ToggleViewerControls(); 
	HideViewerControlsAfterDuration(hideControlsAfterClickDuration);
});

$("#viewer-container .toolbar, #viewer-container .controls").mouseover(function() {
	clearTimeout(hideControlsTimer);
}).mouseout(function() {
	HideViewerControlsAfterDuration(hideControlsAfterClickDuration);
});

// Thumbnail size buttons
// TODO: Reload thumbs if size is bigger?
$(".thumb-size-btns .thumb-size-btn").click(function() {
	var size = "medium";
	if ($(this).hasClass("small-btn"))
		size = "small";
	else if ($(this).hasClass("large-btn"))
		size = "large";
	
	if (supports_html5_storage())
		localStorage["thumbSize"] = size;
			
	$("#thumbnail-container").removeClass("small medium large").addClass(size);
	
	$(".thumb-size-btns .thumb-size-btn.active").removeClass("active");
	$(this).addClass("active");
	
	LoadVisibleThumbs();
});

var thumbSize = (supports_html5_storage()) ? localStorage["thumbSize"] : null;
if (thumbSize != "small" && thumbSize!="medium" && thumbSize!="large" )
	thumbSize = "medium"; //default size
$(".thumb-size-btns ."+thumbSize+"-btn").click();


//open previews based on url hash
$(window).on("hashchange", function(){
	var loc = window.location.hash;
	if (loc.substr(0,9).toLowerCase() == "#preview/") {
		var uuid = encodeURIComponent(loc.substring(9));
		if (showingPreview == false || uuid!==previewUUID)
			OpenPreview(uuid, true);
	} else {
		ClosePreview();
	}
})


//login to server
$("body").on("submit", "#login-form", function(e) {
	var password = $("#login-password").val();
	if (password===undefined || password.length==0)
		return false;
	
	$("#overlay-container").fadeOut();
	CapturePilot.connect(password);
	return false;
});

function ShowLoginForm(serverName) {
	ShowWarning($('<form id="login-form"><h2>'+serverName+'</h2><label for="login-password">You must enter a password to login:</label><input type="password" id="login-password" name="login-password" /><input type="submit" value="Login" /></form>'), true);
	var verifyPass = function () {		
		var pass = $(this).val();
		$("#login-form input[type=submit]").prop('disabled', (pass===undefined || pass.length==0));
	};
	$("#login-password").ready(verifyPass).keyup(verifyPass).focus();
}

//rating/colortag pickers
$("#rating-control input").change(function() {
	if (showingPreview && !$("#rating-control").hasClass("disabled")) {
		var variant = CapturePilot.getVariant(previewUUID, true);
		var rating = $(this).val();
		variant.setRating(rating);
	}
});

$("#colortag-control li").click(function() {
	var colortagCtrl = $("#colortag-control");
	if (showingPreview && !colortagCtrl.hasClass("disabled")) {
		
		if ($(this).hasClass("active-tag")) {
			colortagCtrl.toggleClass("open");
		} else {
			colortagCtrl.find(".active-tag").removeClass("active-tag");
			$(this).addClass("active-tag");			
			colortagCtrl.removeClass("open");
			
			var variant = CapturePilot.getVariant(previewUUID, true);
			var colortag = $(this).index();
			variant.setColorTag(colortag);
		}
	}
});

function ShowWarning(warningHTML, animated) {
	var $overlayContainer = $("#overlay-container");
	if (!$overlayContainer.get(0)) {
		$overlayContainer = $("<div id='overlay-container'></div>").hide();
		$("body").prepend($overlayContainer);
	}
		
	$overlayContainer.html(warningHTML);
	if (animated)
		$overlayContainer.fadeIn('fast');
	else
		$overlayContainer.show();
}

// Register for CapturePilot Callbacks
$(CapturePilot).bind({

// COLLECTION CALLBACKS //
	/*** Capture Pilot has finished starting up ***/
	connected: function(e, result, failureReason) { 
		//TODO: some nice presentation of result == false
		if (result==false) {
			if (failureReason === "UnsupportedBrowser") {
				ShowWarning($("<div class='warning unsupported-browser'><h2>Your browser is not supported</h2><p>Please use <a href='http://www.google.com/chrome/' title='Download Chrome'>Chrome</a>, <a href='http://www.mozilla.com/firefox' title='Download Firefox'>Firefox</a>, <a href='http://www.apple.com/safari/download/' title='Download Safari'>Safari</a>, or <a href='http://ie.microsoft.com' title='Download IE9'>Internet Explorer 9</a></p></div>"), false);
			} else if (failureReason === "AuthenticationFailed") {				
				ShowLoginForm("Capture Pilot Server");
			} else {
				ShowWarning($("<div class='warning server-disconnected'><h2>Unable to Connect to Server</h2></div>"), false);
			}
		} else {
			
		}		
	},
	/*** Something went wrong with Capture Pilot - show a warning ***/
	disconnected: function(e) {
		//TODO: show warning on error
		ShowWarning($("<div class='warning server-disconnected'><h2>Server Disconnected</h2></div>"), true);
		//console.error("Capture Pilot Disconnected!");
	},
	/*** the whole collection changed - remove all images and change labels ***/
	collectionChanged: function(e, properties) {
		CollectionPropertiesChanged(properties);
		$(window).trigger('hashchange');
		
		if ($("#thumbnail-container .thumbnail").length == 0)
			$("#no-variants-label").fadeIn("fast");
		else
			$("#no-variants-label").hide();
	},
	/*** new basic data about the collection - update the labels ***/
	collectionPropertiesModified: function(e, properties) {
		CollectionPropertiesChanged(properties);
	},
	
	
// IMAGE DATA CALLBACKS //
	/*** new thumbnail image src has been loaded - add/update thumbnail image ***/
	thumbnailLoaded: function(e, variant, imgSrc) {
		if (!imgSrc || imgSrc == "") {
			//TODO: maybe something nice, like mark thumb as in error
			console.error("Failed to Load Thumbnail: "+ variant.UUID);
			return;
		}
		var $thumb = GetThumbnailForUUID(variant.encodedUUID());	

		var thumbImage = new Image(); 			
		$(thumbImage).on("load", function(){			
			$(this).addClass("thumbnail-data");
			
			$(this).data("thumbWidth", this.width);
			$(this).data("thumbHeight", this.height);			
			var thumbAspectRatio = (this.width!=0) ? this.height/this.width : 0;
			
			var $thumbImageContainer = $thumb.find(".thumbnail-image");
			var containerAspectRatio = ($thumbImageContainer.width()!=0) ? $thumbImageContainer.height()/$thumbImageContainer.width() : 0;
			if (containerAspectRatio > thumbAspectRatio && thumbAspectRatio!=0) {
				$thumbImageContainer.removeClass("thumb-taller").addClass("thumb-wider");
			} else {	
				$thumbImageContainer.removeClass("thumb-wider").addClass("thumb-taller");
			}

			
			$existingThumbImage = $thumb.find(".thumbnail-data");
			
			var thumbnailNotLoaded = ($existingThumbImage.length <= 0);
			if (thumbnailNotLoaded)
				$(this).hide()
			
			$thumb.find(".thumbnail-data").remove();
			$thumbImageContainer.prepend($(this));
			
			$thumb.find(".thumbnail-loading").fadeOut("fast", function(){ 
					$(this).remove(); 
				});
							
			if (thumbnailNotLoaded)
				$(this).fadeIn("slow");
			else
				$(this).show();
		});			
		thumbImage.src = imgSrc;
	},
	/*** new preview image src has been loaded - update the preview image ***/
	previewLoaded: function(e, variant, imgSrc) {
		if (!imgSrc || imgSrc == "") {
			console.error("Failed to Load Preview: "+ variant.UUID);
			//TODO: maybe something nice, like mark preview as in error
			return;
		}
		
		//check if we have made another request since the first request
		if (previewUUID !== variant.encodedUUID())
			return;
		
		var previewImage = new Image(); 			
		$(previewImage).on("load", function(){
			$(this).addClass("preview-image");
			
			previewImageHeight = this.height;
			previewImageWidth = this.width;			
			previewAspectRatio = (this.width!=0) ? this.height/this.width : 0;
			
			$preview.find("img").remove();
			$preview.append(this);
			
			$preview.find(".spinner").remove();
			
			UpdatePreviewAspectRatio();
		});			
		previewImage.src = imgSrc;
	},

// VARIANT CHANGE EVENTS //
	/*** some new variants arrived - add thumb and start loading the thumbnail data ***/
	variantsAdded: function(e, variants) { VariantsAdded(variants, true); },
	
	/*** some variants have been removed - remove thumb and close preview ***/
	variantsRemoved: function(e, variants) { VariantsRemoved(variants); },
	
	/*** the image data of some variants has been modifed - ask for the new thumbnail (and preview) ***/
	variantsModified: function(e, variants) {
		var varCnt = variants.length;
		for(var i=0; i<varCnt; i++) {
			var variant = variants[i];
			//TODO: use picked thumbnail size, rather than max size
			var sizeToLoad = CurrentThumbSize();
			variant.loadThumbnailAsync(sizeToLoad.w, sizeToLoad.h);
			
			//if it is the active variant then call for another update of the preview
			if (showingPreview && previewUUID==variant.encodedUUID()) {
				var newPreviewHeight = $(window).height(), 
					newPreviewWidth = $(window).width();
				variant.loadPreviewAsync(newPreviewWidth, newPreviewHeight);
			}
		}
	},
	
	/*** the metadata (name/...) of some variants has changed - update labels ***/
	variantsMetadataModified: function(e, variants) {
		
		var varCnt = variants.length;
		for(var i=0; i<varCnt; i++) {
			var variant = variants[i];
			var uuid = variant.encodedUUID();
			var $thumbnail = GetThumbnailForUUID(uuid);
			
			//set the name
			UpdateVariantThumbName($thumbnail);
			
			var origVariantNumber = $thumbnail.data("variantNumber");			
			if (variant.VariantNumber != origVariantNumber) {
				$thumbnail.data("variantNumber", variant.VariantNumber);
				SortVariantThumb($thumbnail);
			}
			
			if (showingPreview && uuid==previewUUID) {
				SetPreviewRating(variant.Rating);
				SetPreviewColorTag(variant.ColorTag);
			}
		}
	}
});

//Finally, start the server communication
CapturePilot.connect();

});
