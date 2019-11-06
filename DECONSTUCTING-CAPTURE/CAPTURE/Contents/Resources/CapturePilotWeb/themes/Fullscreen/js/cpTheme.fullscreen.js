jQuery(document).ready(function($) {
$("noscript").remove();

var hideControlsAfterConnectDuration = 5000; //ms
	hideControlsAfterMouseMoveDuration = 2000; //ms
	hideControlsAfterMouseOutDuration = 500; //ms
var hideControlsTimer, 
	loadPreviewTimer;

//TODO: use variant thumb sizes
var thumbSizes ={	small: {w:999,h:80} //max-size
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

//////////////////////////////////
// UI UPDATE METHODS

// Update UI after the collection properties changes
function CollectionPropertiesChanged(changedProperties) {
	//Collection name changed
	if (changedProperties["SelectedFolder"] !== undefined) {
		var newTitle = changedProperties["SelectedFolder"].value;
		if (newTitle === undefined) newTitle = "Unknown Collection";
		catalogName = newTitle;
		
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
		
		for(var i=0; i<varCnt; i++) {
			var variant = variants[i];
			
			var $newThumb = $('<div class="thumbnail thumbnail-not-loaded new-thumb" id="'+variant.encodedUUID()+'"><div class="thumbnail-image"></div><div class="thumbnail-label">'+VariantName(variant)+'</div></div>').css({opacity:0});
			
			$newThumb.data("variant", variant);			
			$newThumb.data("variantNumber", variant.VariantNumber);
			
			SortVariantThumb($newThumb);
		}
		
		UpdatePageStartIndexesAndThumbnailContainerWidth();
		$("#thumbnail-container .thumbnail.new-thumb").animate({opacity:1}, "slow", function(){
			$(this).removeClass("new-thumb");
		}).promise().done(function() {
			UpdateViewsForThumbCount();
			if (showingPreview==false) {
				//wait a moment to try to open the first image
				setTimeout(function(){ 
					var uuid = $("#thumbnail-container .thumbnail:first-child").attr('id');
					if (showingPreview == false || uuid!==previewUUID) {
						OpenPreview(uuid);
						
						clearTimeout(hideControlsTimer);						
						if (!clickMode) {	
							ToggleViewerControls(true);
							HideViewerControlsAfterDuration(hideControlsAfterConnectDuration);
						}
					}
				},500);			
			}
		});
	}
}

// Update UI when some variants are removed - remove thumbs individually and close preview if necessary
//  ... or just clear view if collection empty and show no-variants label.
function VariantsRemoved(variants) {
	//get all thumbs to be removed
	var varCnt = (variants) ? variants.length : 0;
	var closePreview = false;
	for(var i=0; i<varCnt; i++) {
		var uuid = variants[i].encodedUUID();
		var $variantThumb = GetThumbnailForUUID(uuid);
		
		$variantThumb.addClass("removed-thumb");
		
		//if it is the active variant then close the preview
		if (closePreview == false)
			closePreview = (previewUUID == uuid);

		$("#thumbnail-container .thumbnail").each(function(){
			var thumbVariant = $(this).data("variant");
			if (thumbVariant.UUID!=variants[i].UUID && variants[i].ImageUUID==thumbVariant.ImageUUID)
				UpdateVariantThumbName($(this));
		});
	}
	
	if (closePreview)
		ClosePreview();

	//if all to be removed then clear the just delete, rather than fade
	if ($("#thumbnail-container .thumbnail:not(.removed-thumb)").length == 0) {
		$("#thumbnail-container .thumbnail").remove();
	} else {
		$("#thumbnail-container .thumbnail.removed-thumb").remove();
	}
			
	UpdatePageStartIndexesAndThumbnailContainerWidth();
}

function CurrentThumbSize() {
	return thumbSizes.small;
}


// Transission to viewer for a specific UUID, initially using the thumb image (if it is loaded).
// ... also show the spinner and start loading the large preview (after a short period)
function OpenPreview(uuid) {
	var variant = CapturePilot.getVariant(uuid, true);
	if (!variant) return;
	
	$(".thumbnail.active").removeClass('active');
	var thumbnail = GetThumbnailForUUID(uuid);
	
	//if the viewer is not currently showing the correct image, then use the thumbnail
	if (previewUUID !== uuid) {			
		$preview.find("img.preview-image, img.temp-preview").remove();
		
		//get the src of the thumb, and use that temporarily
		var $thumbnailImage = thumbnail.find(".thumbnail-image img");
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
	thumbnail.addClass('active');
	
	var newHash = "#Preview/"+decodeURIComponent(uuid);
	if (window.location.hash != newHash)
		window.location.hash = newHash;
	
	document.title = VariantName(variant)+" - "+catalogName;
	
	//show the spinner
	
	if ($preview.find(".spinner").length <= 0)
    	$preview.append("<div class='spinner'><span>Loading</span></div>")/*.ready(function() { RotateSpinner($preview.find(".spinner")); })*/;
	
	
	SetPreviewRating(variant.Rating);	
	SetPreviewColorTag(variant.ColorTag);
	$("#preview-title").html(VariantName(variant));		
	$("#viewer-container").fadeIn('fast');	
	
	GoToThumbnailPage(PageForThumbnailAtIndex(thumbnail.index()));
	
	UpdatePreviewAspectRatio();
	
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
	var thumbIndex = GetThumbnailForUUID(previewUUID).index();
	var newThumbIndex = (thumbIndex>0)?thumbIndex-1:1;
	
	var $newThumb = $("#thumbnail-container .thumbnail:not(.removed-thumb)").get(newThumbIndex);
	if (!$newThumb) {
		showingPreview = false;
		UpdateViewsForThumbCount();
		window.location.hash = "";
		document.title = catalogName;
	} else if ($newThumb.id != previewUUID) {
		OpenPreview($newThumb.id);
	}
}

// Show/Hide the viewer's toolbar
var viewerControlsVisible = undefined;
function ToggleViewerControls(show) {
	
	var speed = "fast";
	var title = $("#preview-title");
	var controls = $("#viewer-container .controls");
	var browser = $("#browser-container");
	
	if (viewerControlsVisible == undefined)
		viewerControlsVisible = title.is(":visible");
		
	if (viewerControlsVisible == show)
		return;		
	if (show===undefined)
		show = viewerControlsVisible;
		
	if (show) {
		title.slideDown(speed);
		controls.fadeIn(speed);
	} else {
		title.slideUp(speed);
		controls.fadeOut(speed);
	}	
	browser.fadeTo(speed, (show)?1:0);
	
	viewerControlsVisible = show;
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

function GetFirstThumbnail() { return $("#thumbnail-container .thumbnail:first-child").get(0); }
function GetLastThumbnail() { return $("#thumbnail-container .thumbnail:last-child").get(0); }

//Get UUID of next / prev image in thumbnail list
function NextVariantUUID(currentUUID) {
	if (!currentUUID) return null;
	
	var $nextThumb = GetThumbnailForUUID(currentUUID).next().get(0);	
	if (!$nextThumb) $nextThumb = GetFirstThumbnail();
	return ($nextThumb) ? $nextThumb.id : null;
}
function PrevVariantUUID(currentUUID) {
	if (!currentUUID) return null;
	
	var $prevThumb = GetThumbnailForUUID(currentUUID).prev().get(0);	
	if (!$prevThumb) $prevThumb = GetLastThumbnail();	
	return ($prevThumb) ? $prevThumb.id : null;
}

// Trigger OpenPreview for Next/Prev image in thumbnail list
function OpenNextVariantPreview() {
	if (showingPreview === false)
		return;
	OpenPreview(NextVariantUUID(previewUUID));
}
function OpenPrevVariantPreview() {
	if (showingPreview === false)
		return;
	OpenPreview(PrevVariantUUID(previewUUID));
}



//////////////////////////////////
// THUMBNAIL LOADING 

var pageStartIndexes = [0];
var currPage = 0;
function UpdatePageStartIndexesAndThumbnailContainerWidth() {	
	UpdateViewsForThumbCount();
	
	var thumbContainer = $("#thumbnail-container");	
	var browserWidth = $("#browser-container").width();
	
	var currPageStartIndex = pageStartIndexes[currPage];
	
	pageStartIndexes = [0];
	
	var currPageStartPos = 0;
	var totalWidth = 1; //need 1px extra for no wrapping
	
	thumbContainer.find('.thumbnail').each(function(index) {
		var thumbWidth = $(this).outerWidth(true);
    	totalWidth += thumbWidth;
    	
		var thumbRightEdge = $(this).position().left+thumbWidth;
		//this thumb is not visible
		if ((thumbRightEdge - currPageStartPos) > browserWidth) {
			currPageStartPos = $(this).position().left;
			pageStartIndexes.push(index);
		}
	});
	
	thumbContainer.width(totalWidth);	
	
	//go thru the page start indexes, to find the page the current start index is on.
	var prevCurrPage = currPage;
	currPage = 0;
	jQuery.each(pageStartIndexes, function(pageIndex) {
		if (pageStartIndexes[pageIndex] <= currPageStartIndex)
			currPage = pageIndex
		else
			return false;
	});
	
	//make sure that the current first image is the first image of a page
	var newCurrPageOffset = pageStartIndexes[currPage] - currPageStartIndex;
	if (newCurrPageOffset != 0) {	
		for (var pageIndex = 1; pageIndex<pageStartIndexes.length; pageIndex++) {			
			var newStartIndex = pageStartIndexes[pageIndex]-newCurrPageOffset;
			newStartIndex = Math.max(0,newStartIndex);
			pageStartIndexes[pageIndex] = newStartIndex;
		}
	
	}
	//clamp currPage
	currPage = Math.max(0, currPage);
	currPage = Math.min(pageStartIndexes.length-1, currPage);

	GoToThumbnailPage(currPage);
	/*
	thumbContainer.find('.thumbnail').css('outline', '0px solid green');
	jQuery.each(pageStartIndexes, function(pageIndex) {
		var color = (pageIndex==currPage)?'red':'green';
		thumbContainer.find('.thumbnail:nth-child('+(pageStartIndexes[pageIndex]+1)+')').css('outline', '1px solid '+color);
	});
	*/
	
	//LoadVisibleThumbs();
			
	//UpdateThumbnailNavButtons();
}
function UpdateThumbnailNavButtons() {
	$(".thumbnail-nav-left").toggleClass("disabled", (currPage <= 0));
	$(".thumbnail-nav-right").toggleClass("disabled", (currPage >= pageStartIndexes.length-1));
}

function PageForThumbnailAtIndex(thumbIndex) {
	var pageNum = 0;
	jQuery.each(pageStartIndexes, function(pageIndex) {
		if (thumbIndex < pageStartIndexes[pageIndex])
			return false;
		pageNum = pageIndex;
	});
	return pageNum
}

function GoToThumbnailPage(page) {
	currPage = page;
	
	if (currPage >= 0 && currPage <= (pageStartIndexes.length-1)) {
		var firstThumbPos = $("#thumbnail-container .thumbnail:nth-child("+(pageStartIndexes[currPage]+1)+")").position();
		var thumbLeftEdge = (firstThumbPos)?firstThumbPos.left:0;
		var newLeft = (thumbLeftEdge > 0)?(thumbLeftEdge*-1):0;
		
		$("#thumbnail-container").animate({left: newLeft}, "fast", function(){
			LoadVisibleThumbs();
		});
	}
	
	UpdateThumbnailNavButtons();
}
$(".thumbnail-nav-left").click(function() {
	if ($(this).hasClass("disabled"))
		return;
	
	GoToThumbnailPage(currPage-1);
});
$(".thumbnail-nav-right").click(function() {
	if ($(this).hasClass("disabled"))
		return;
		
	GoToThumbnailPage(currPage+1);
});


// Load thumbs when they scroll into view

function IsThumbVisible(elem) {
    var docViewLeft = 0;
    var docViewRight = docViewLeft + $(window).width();

    var elemLeft = $(elem).offset().left;
    var elemRight = elemLeft + $(elem).width();
	
	var visible = ((elemRight >= docViewLeft) && (elemLeft <= docViewRight));
	
    return ((elemRight >= docViewLeft) && (elemLeft <= docViewRight));
}

// Start loading thumbnails that are within the view
function LoadVisibleThumbs() {
	$("#thumbnail-container .thumbnail.thumbnail-not-loaded").each(function(index, element) {
		if (IsThumbVisible(element)) {
			$(element).removeClass("thumbnail-not-loaded").addClass("thumbnail-loading");
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
	
	UpdatePageStartIndexesAndThumbnailContainerWidth();
	UpdateThumbnailNavButtons();
	
	//add classes to the preview so it scales properly
	UpdatePreviewAspectRatio();
	
	//check if new thumbs have come into view
	//LoadVisibleThumbs();
}).trigger("resize");



// Bind to Next / Previous Image buttons
$("#prev-variant-button").click(function() { OpenPrevVariantPreview(); });
$("#next-variant-button").click(function() { OpenNextVariantPreview(); });

// Click on Thumbnail (loaded & loading) - now and all future matching DOM elements
$("body").on('click', ".thumbnail-image img, .thumbnail-loading .thumbnail-image", function(){	
	OpenPreview($(this).closest(".thumbnail").attr('id'));	
});

var clickMode = undefined;
var mouseEventTimer;
$("#viewer-container, #browser-container").bind('mousemove',function() {	
	//somewhat of a hack so that touchevent comes first
	clearTimeout(mouseEventTimer);
	mouseEventTimer = setTimeout(function() {
		if (!clickMode) {
			clearTimeout(hideControlsTimer);
			ToggleViewerControls(true);
			HideViewerControlsAfterDuration(hideControlsAfterMouseMoveDuration);
		}	
	}, 10);
}).mouseout(function() {
	clearTimeout(mouseEventTimer);
	mouseEventTimer = setTimeout(function() {
		if (!clickMode) {
			clearTimeout(hideControlsTimer);
			HideViewerControlsAfterDuration(hideControlsAfterMouseOutDuration);
		}
	}, 10);
});
$("#browser-container").click(function(){
	clearTimeout(hideControlsTimer);
	mouseEventTimer = setTimeout(function() {
		if (!clickMode) {
			ToggleViewerControls(true);
			HideViewerControlsAfterDuration(hideControlsAfterMouseMoveDuration);
		}
	}, 10);
		
});
$("#viewer-container .preview").bind('touchend', function(){
	clearTimeout(mouseEventTimer);
	clickMode = true;
		
	clearTimeout(hideControlsTimer);
	ToggleViewerControls(!viewerControlsVisible);
});
$("#browser-container").bind('touchend', function(){
	clearTimeout(mouseEventTimer);
	clickMode = true;
		
	clearTimeout(hideControlsTimer);
	ToggleViewerControls(true);
});


//open previews based on url hash
var hashChangeTimer;
$(window).on('hashchange', function(){
	var loc = window.location.hash;
	if (loc.substr(0,9).toLowerCase() == "#preview/") {
		var uuid = encodeURIComponent(loc.substring(9));
		clearTimeout(hashChangeTimer);
		hashChangeTimer = setTimeout(function(){ 
			if (showingPreview == false || uuid!==previewUUID) {
				OpenPreview(uuid); 				
			}
		},500);
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

var viewUpdateTimer;
function UpdateViewsForThumbCount() {
	if (IsCollectionEmpty()) {
		$("#viewer-container").animate({opacity:0}, "fast");
		ToggleViewerControls(false);
	} else {		
		$("#viewer-container").animate({opacity:1}, "medium");
		ToggleViewerControls(viewerControlsVisible);
	}	
	
	clearTimeout(viewUpdateTimer);
	viewUpdateTimer = setTimeout(function() {	
		if (IsCollectionEmpty())
			$("#no-variants-label").fadeIn("fast");
		else
			$("#no-variants-label").hide();
	}, 500);
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
		
		UpdatePageStartIndexesAndThumbnailContainerWidth();
		ToggleViewerControls(true);
	},
	/*** new basic data about the collection - update the labels ***/
	collectionPropertiesModified: function(e, properties) {
		CollectionPropertiesChanged(properties);
	},
	
	
// IMAGE DATA CALLBACKS //
	/*** new thumbnail image src has been loaded - add/update thumbnail image ***/
	thumbnailLoaded: function(e, variant, imgSrc) {
		if (!imgSrc || imgSrc == "") {
			//Called if collection changes mid-load
			//console.error("Failed to Load Thumbnail: "+ variant.UUID);
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

			$("#thumbnail-container").width("+="+$thumb.outerWidth(true));
			$existingThumbImage = $thumb.find(".thumbnail-data");
			
			var thumbnailNotLoaded = ($existingThumbImage.length <= 0);
			if (thumbnailNotLoaded)
				$(this).hide()
			
			$thumb.find(".thumbnail-data").remove();
			$thumbImageContainer.prepend($(this));
			
			$thumb.removeClass("thumbnail-loading");
		
			if (thumbnailNotLoaded)
				$(this).fadeIn("slow");
			else
				$(this).show();
				
			UpdatePageStartIndexesAndThumbnailContainerWidth();
			
			//if preview not loaded yet, load that
			if (previewUUID == variant.encodedUUID() && $preview.find(".preview-image").length<=0) {
				var $tempPreviewImg = $preview.find("img.temp-preview");
				if ($tempPreviewImg.length <= 0) {
					$tempPreviewImg = $("<img class='temp-preview' src=''/>")
					$preview.prepend($tempPreviewImg);
				}
				$tempPreviewImg.attr("src", imgSrc).show();

				//update the preview's aspect ratio (only rough value from thumbnail)
				previewAspectRatio = ($(this).width()!=0)?$(this).height()/$(this).width():0;
			}
		});			
		thumbImage.src = imgSrc;
	},
	/*** new preview image src has been loaded - update the preview image ***/
	previewLoaded: function(e, variant, imgSrc) {
		if (!imgSrc || imgSrc == "") {
			//console.error("Failed to Load Preview: "+ variant.UUID);
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
