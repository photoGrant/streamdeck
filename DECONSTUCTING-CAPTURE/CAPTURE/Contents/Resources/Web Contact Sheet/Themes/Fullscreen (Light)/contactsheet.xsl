<?xml version="1.0" encoding="UTF-8"?>
<!-- Copyright (c) 2007 Phase One. All rights reserved -->

<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

	<!-- <xsl:output encoding="UTF-8" indent="no" method="xml" 
		doctype-public="-//W3C//DTD XHTML 1.0 Strict//EN" 
		doctype-system="http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"/> -->
	<xsl:output encoding="UTF-8" indent="yes" method="html" 
		doctype-public="html" />
	
	<!-- Main document -->
	<xsl:template match="/">
	<html lang="sv">
		<head>
			<title><xsl:value-of select="contactsheet/info/sheet-title" /></title>
			<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
			<meta name="generator" content="Capture One http://phaseone.com/" />
			<meta name="author" content="{contactsheet/info/author}" />

			<script src="scripts/jquery.min.js"></script>
			<script src="scripts/galleria.js"></script>			
            
            <style type="text/css">
                html, body { background-color: #ccc;}
            </style>

			<link rel="stylesheet" type="text/css" media="screen, print" href="theme/fullscreenlight_contactsheet.css" />
			<xsl:comment><![CDATA[[if IE]>
			<link rel="stylesheet" type="text/css" media="screen, print" href="theme/fullscreenlight_contactsheet_ie.css">
			<![endif]]]></xsl:comment>
		</head>
			<xsl:apply-templates />
	</html>
	</xsl:template>
	
	<!-- TEMPLATES -->
	
	<xsl:template match="contactsheet">
		<body>
				
			<div id="toggle-info-button"> </div>
			<div id="info-panel" style="left:-300px; opacity:0;">
				<div id="wcs-title"><xsl:value-of select="info/sheet-title" /></div>
				<div id="wcs-description"><xsl:value-of select="info/sheet-description" /></div>
				<div id="contact-info-box">Copyright © <a href="{info/contact-link}" id="wcs-contact-link"><xsl:value-of select="info/contact" /></a></div>
			</div>
			
			<xsl:apply-templates />
			
			<script type="text/javascript">
				Galleria.loadTheme('theme/galleria.fullscreen_light.js');
				$('#galleria').galleria();					
				
				function toggleInfoPanel(showIt) {
					var infoPanel = $("#info-panel");
					var toggleButton = $("#toggle-info-button");
					
					if (showIt) {				
						toggleButton.fadeOut("fast", function(){
							toggleButton.addClass("panel-open").fadeIn();
						});
						
						infoPanel.animate({
							opacity: 1,
							left: "0px"
						}, "fast");
					} else {
							
						toggleButton.fadeOut("fast", function(){
							toggleButton.removeClass("panel-open").fadeIn();
						});
						
						infoPanel.animate({
							opacity: 0,			
							left: "-300px"
						}, "fast");			
					}	
				}
				toggleInfoPanel(false);	
				//close panel on click outside
				$('body').click(function() { 
					if ($("#toggle-info-button").hasClass("panel-open")) 
						toggleInfoPanel(false); 
				});
				$('#infoPanel').click(function(event){ event.stopPropagation(); });
				$("#toggle-info-button").click(function(event){		
					toggleInfoPanel( $(this).hasClass("panel-open") == false);
					event.stopPropagation(); 	
				});				
			</script>
		</body>
	</xsl:template>

	<xsl:template match="contactsheet/selection">
			<div id="galleria" >
				<xsl:apply-templates />
			</div>
	</xsl:template>
		
	<xsl:template match="contactsheet/selection/photo">	
		<a href="{preview-path}">
			<img src="{thumbnail-path}" id="{@id}" title="{caption}" />
		</a>
	</xsl:template>
	
	<xsl:template match="*">
	</xsl:template>
	
</xsl:stylesheet>
